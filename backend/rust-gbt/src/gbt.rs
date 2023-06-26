use priority_queue::PriorityQueue;
use std::{
    cmp::Ordering,
    collections::{HashMap, HashSet, VecDeque},
};

use crate::{
    audit_transaction::AuditTransaction,
    u32_hasher_types::{
        u32hashmap_with_capacity, u32hashset_new, u32priority_queue_with_capacity, U32HasherState,
    },
    GbtResult, ThreadTransactionsMap, STARTING_CAPACITY,
};

const BLOCK_WEIGHT_UNITS: u32 = 4_000_000;
const BLOCK_SIGOPS: u32 = 80_000;
const BLOCK_RESERVED_WEIGHT: u32 = 4_000;
const MAX_BLOCKS: usize = 8;

type AuditPool = HashMap<u32, AuditTransaction, U32HasherState>;
type ModifiedQueue = PriorityQueue<u32, TxPriority, U32HasherState>;

struct TxPriority {
    uid: u32,
    score: f64,
}
impl PartialEq for TxPriority {
    fn eq(&self, other: &Self) -> bool {
        self.uid == other.uid
    }
}
impl Eq for TxPriority {}
impl PartialOrd for TxPriority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        if self.score == other.score {
            Some(self.uid.cmp(&other.uid))
        } else {
            self.score.partial_cmp(&other.score)
        }
    }
}
impl Ord for TxPriority {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).expect("score will never be NaN")
    }
}

/// Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core
///
/// See `BlockAssembler` in Bitcoin Core's
/// [miner.cpp](https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp).
/// Ported from mempool backend's
/// [tx-selection-worker.ts](https://github.com/mempool/mempool/blob/master/backend/src/api/tx-selection-worker.ts).
//
// TODO: Make gbt smaller to fix these lints.
#[allow(clippy::too_many_lines)]
#[allow(clippy::cognitive_complexity)]
pub fn gbt(mempool: &mut ThreadTransactionsMap) -> Option<GbtResult> {
    let mut audit_pool: AuditPool = u32hashmap_with_capacity(STARTING_CAPACITY);
    let mut mempool_array: VecDeque<u32> = VecDeque::with_capacity(STARTING_CAPACITY);
    let mut clusters: Vec<Vec<u32>> = Vec::new();

    // Initialize working structs
    for (uid, tx) in mempool {
        let audit_tx = AuditTransaction::from_thread_transaction(tx);
        // Safety: audit_pool and mempool_array must always contain the same transactions
        audit_pool.insert(audit_tx.uid, audit_tx);
        mempool_array.push_back(*uid);
    }

    // Build relatives graph & calculate ancestor scores
    for txid in &mempool_array {
        set_relatives(*txid, &mut audit_pool);
    }

    // Sort by descending ancestor score
    mempool_array.make_contiguous().sort_unstable_by(|a, b| {
        let a_tx = audit_pool
            .get(a)
            .expect("audit_pool contains exact same txes as mempool_array");
        let b_tx = audit_pool
            .get(b)
            .expect("audit_pool contains exact same txes as mempool_array");
        b_tx.cmp(a_tx)
    });

    // Build blocks by greedily choosing the highest feerate package
    // (i.e. the package rooted in the transaction with the best ancestor score)
    let mut blocks: Vec<Vec<u32>> = Vec::new();
    let mut block_weight: u32 = BLOCK_RESERVED_WEIGHT;
    let mut block_sigops: u32 = 0;
    let mut transactions: Vec<u32> = Vec::with_capacity(STARTING_CAPACITY);
    let mut modified: ModifiedQueue = u32priority_queue_with_capacity(STARTING_CAPACITY);
    let mut overflow: Vec<u32> = Vec::new();
    let mut failures = 0;
    while !mempool_array.is_empty() || !modified.is_empty() {
        let next_txid: u32;
        let from_modified: bool;
        if modified.is_empty() {
            next_txid = mempool_array.pop_front()?;
            from_modified = false;
        } else if mempool_array.is_empty() {
            next_txid = modified.pop()?.0;
            from_modified = true;
        } else {
            let next_array_txid = mempool_array.front()?;
            let next_modified_txid = modified.peek()?.0;
            let array_tx: &AuditTransaction = audit_pool.get(next_array_txid)?;
            let modified_tx: &AuditTransaction = audit_pool.get(next_modified_txid)?;
            match array_tx.cmp(modified_tx) {
                std::cmp::Ordering::Equal | std::cmp::Ordering::Greater => {
                    next_txid = mempool_array.pop_front()?;
                    from_modified = false;
                }
                std::cmp::Ordering::Less => {
                    next_txid = modified.pop()?.0;
                    from_modified = true;
                }
            }
        }

        let next_tx = audit_pool.get(&next_txid)?;

        // skip the transaction if it has already been used
        // or has been moved to the "modified" priority queue
        if next_tx.used || (!from_modified && next_tx.modified) {
            continue;
        }

        if blocks.len() < (MAX_BLOCKS - 1)
            && ((block_weight + next_tx.ancestor_weight >= BLOCK_WEIGHT_UNITS)
                || (block_sigops + next_tx.ancestor_sigops > BLOCK_SIGOPS))
        {
            // hold this package in an overflow list while we check for smaller options
            overflow.push(next_txid);
            failures += 1;
        } else {
            let mut package: Vec<(u32, usize)> = Vec::new();
            let mut cluster: Vec<u32> = Vec::new();
            let is_cluster: bool = !next_tx.ancestors.is_empty();
            for ancestor_id in &next_tx.ancestors {
                if let Some(ancestor) = audit_pool.get(ancestor_id) {
                    package.push((*ancestor_id, ancestor.ancestors.len()));
                }
            }
            package.sort_unstable_by_key(|a| a.1);
            package.push((next_txid, next_tx.ancestors.len()));

            let cluster_rate = next_tx
                .dependency_rate
                .min(next_tx.ancestor_fee as f64 / (f64::from(next_tx.ancestor_weight) / 4.0));

            for (txid, _) in &package {
                cluster.push(*txid);
                if let Some(tx) = audit_pool.get_mut(txid) {
                    tx.used = true;
                    if tx.effective_fee_per_vsize != cluster_rate {
                        tx.effective_fee_per_vsize = cluster_rate;
                        tx.dirty = true;
                    }
                    transactions.push(tx.uid);
                    block_weight += tx.weight;
                    block_sigops += tx.sigops;
                }
                update_descendants(*txid, &mut audit_pool, &mut modified, cluster_rate);
            }

            if is_cluster {
                clusters.push(cluster);
            }

            failures = 0;
        }

        // this block is full
        let exceeded_package_tries =
            failures > 1000 && block_weight > (BLOCK_WEIGHT_UNITS - BLOCK_RESERVED_WEIGHT);
        let queue_is_empty = mempool_array.is_empty() && modified.is_empty();
        if (exceeded_package_tries || queue_is_empty) && blocks.len() < (MAX_BLOCKS - 1) {
            // finalize this block
            if !transactions.is_empty() {
                blocks.push(transactions);
            }
            // reset for the next block
            transactions = Vec::with_capacity(STARTING_CAPACITY);
            block_weight = 4000;
            block_sigops = 0;
            failures = 0;
            // 'overflow' packages didn't fit in this block, but are valid candidates for the next
            overflow.reverse();
            for overflowed in &overflow {
                if let Some(overflowed_tx) = audit_pool.get(overflowed) {
                    if overflowed_tx.modified {
                        modified.push(
                            *overflowed,
                            TxPriority {
                                uid: *overflowed,
                                score: overflowed_tx.score(),
                            },
                        );
                    } else {
                        mempool_array.push_front(*overflowed);
                    }
                }
            }
            overflow = Vec::new();
        }
    }
    // add the final unbounded block if it contains any transactions
    if !transactions.is_empty() {
        blocks.push(transactions);
    }

    // make a list of dirty transactions and their new rates
    let mut rates: Vec<Vec<f64>> = Vec::new();
    for (txid, tx) in audit_pool {
        if tx.dirty {
            rates.push(vec![f64::from(txid), tx.effective_fee_per_vsize]);
        }
    }

    Some(GbtResult {
        blocks,
        clusters,
        rates,
    })
}

fn set_relatives(txid: u32, audit_pool: &mut AuditPool) {
    let mut parents: HashSet<u32, U32HasherState> = u32hashset_new();
    if let Some(tx) = audit_pool.get(&txid) {
        if tx.relatives_set_flag {
            return;
        }
        for input in &tx.inputs {
            parents.insert(*input);
        }
    } else {
        return;
    }

    let mut ancestors: HashSet<u32, U32HasherState> = u32hashset_new();
    for parent_id in &parents {
        set_relatives(*parent_id, audit_pool);

        if let Some(parent) = audit_pool.get_mut(parent_id) {
            // Safety: ancestors must always contain only txes in audit_pool
            ancestors.insert(*parent_id);
            parent.children.insert(txid);
            for ancestor in &parent.ancestors {
                ancestors.insert(*ancestor);
            }
        }
    }

    let mut total_fee: u64 = 0;
    let mut total_weight: u32 = 0;
    let mut total_sigops: u32 = 0;

    for ancestor_id in &ancestors {
        let ancestor = audit_pool
            .get(ancestor_id)
            .expect("audit_pool contains all ancestors");
        total_fee += ancestor.fee;
        total_weight += ancestor.weight;
        total_sigops += ancestor.sigops;
    }

    if let Some(tx) = audit_pool.get_mut(&txid) {
        tx.set_ancestors(ancestors, total_fee, total_weight, total_sigops);
    }
}

// iterate over remaining descendants, removing the root as a valid ancestor & updating the ancestor score
fn update_descendants(
    root_txid: u32,
    audit_pool: &mut AuditPool,
    modified: &mut ModifiedQueue,
    cluster_rate: f64,
) {
    let mut visited: HashSet<u32, U32HasherState> = u32hashset_new();
    let mut descendant_stack: Vec<u32> = Vec::new();
    let root_fee: u64;
    let root_weight: u32;
    let root_sigops: u32;
    if let Some(root_tx) = audit_pool.get(&root_txid) {
        for descendant_id in &root_tx.children {
            if !visited.contains(descendant_id) {
                descendant_stack.push(*descendant_id);
                visited.insert(*descendant_id);
            }
        }
        root_fee = root_tx.fee;
        root_weight = root_tx.weight;
        root_sigops = root_tx.sigops;
    } else {
        return;
    }
    while let Some(next_txid) = descendant_stack.pop() {
        if let Some(descendant) = audit_pool.get_mut(&next_txid) {
            // remove root tx as ancestor
            let old_score =
                descendant.remove_root(root_txid, root_fee, root_weight, root_sigops, cluster_rate);
            // add to priority queue or update priority if score has changed
            if descendant.score() < old_score {
                descendant.modified = true;
                modified.push_decrease(
                    descendant.uid,
                    TxPriority {
                        uid: descendant.uid,
                        score: descendant.score(),
                    },
                );
            } else if descendant.score() > old_score {
                descendant.modified = true;
                modified.push_increase(
                    descendant.uid,
                    TxPriority {
                        uid: descendant.uid,
                        score: descendant.score(),
                    },
                );
            }

            // add this node's children to the stack
            for child_id in &descendant.children {
                if !visited.contains(child_id) {
                    descendant_stack.push(*child_id);
                    visited.insert(*child_id);
                }
            }
        }
    }
}
