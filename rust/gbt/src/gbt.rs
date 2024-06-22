use priority_queue::PriorityQueue;
use std::{cmp::Ordering, collections::HashSet, mem::ManuallyDrop};
use tracing::{info, trace};

use crate::{
    audit_transaction::{partial_cmp_uid_score, AuditTransaction},
    u32_hasher_types::{u32hashset_new, u32priority_queue_with_capacity, U32HasherState},
    GbtResult, ThreadTransactionsMap, thread_acceleration::ThreadAcceleration,
};

const BLOCK_SIGOPS: u32 = 80_000;
const BLOCK_RESERVED_WEIGHT: u32 = 4_000;
const BLOCK_RESERVED_SIGOPS: u32 = 400;

type AuditPool = Vec<Option<ManuallyDrop<AuditTransaction>>>;
type ModifiedQueue = PriorityQueue<u32, TxPriority, U32HasherState>;

#[derive(Debug)]
struct TxPriority {
    uid: u32,
    order: u32,
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
        partial_cmp_uid_score(
            (self.uid, self.order, self.score),
            (other.uid, other.order, other.score),
        )
    }
}
impl Ord for TxPriority {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).expect("score will never be NaN")
    }
}

/// Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core.
///
/// See `BlockAssembler` in Bitcoin Core's
/// [miner.cpp](https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp).
/// Ported from mempool backend's
/// [tx-selection-worker.ts](https://github.com/mempool/mempool/blob/master/backend/src/api/tx-selection-worker.ts).
//
// TODO: Make gbt smaller to fix these lints.
#[allow(clippy::too_many_lines)]
#[allow(clippy::cognitive_complexity)]
pub fn gbt(
    mempool: &mut ThreadTransactionsMap,
    accelerations: &[ThreadAcceleration],
    max_uid: usize,
    max_block_weight: u32,
    max_blocks: usize,
) -> GbtResult {
    let mut indexed_accelerations = Vec::with_capacity(max_uid + 1);
    indexed_accelerations.resize(max_uid + 1, None);
    for acceleration in accelerations {
        indexed_accelerations[acceleration.uid as usize] = Some(acceleration);
    }

    info!("Initializing working vecs with uid capacity for {}", max_uid + 1);
    let mempool_len = mempool.len();
    let mut audit_pool: AuditPool = Vec::with_capacity(max_uid + 1);
    audit_pool.resize(max_uid + 1, None);
    let mut mempool_stack: Vec<u32> = Vec::with_capacity(mempool_len);
    let mut clusters: Vec<Vec<u32>> = Vec::new();
    let mut block_weights: Vec<u32> = Vec::new();

    info!("Initializing working structs");
    for (uid, tx) in &mut *mempool {
        let acceleration = indexed_accelerations.get(*uid as usize);
        let audit_tx = AuditTransaction::from_thread_transaction(tx, acceleration.copied());
        // Safety: audit_pool and mempool_stack must always contain the same transactions
        audit_pool[*uid as usize] = Some(ManuallyDrop::new(audit_tx));
        mempool_stack.push(*uid);
    }

    info!("Building relatives graph & calculate ancestor scores");
    for txid in &mempool_stack {
        set_relatives(*txid, &mut audit_pool);
    }
    trace!("Post relative graph Audit Pool: {:#?}", audit_pool);

    info!("Sorting by descending ancestor score");
    let mut mempool_stack: Vec<(u32, u32, f64)> = mempool_stack
        .into_iter()
        .map(|txid| {
            let atx = audit_pool
                .get(txid as usize)
                .and_then(Option::as_ref)
                .expect("All txids are from audit_pool");
            (txid, atx.order(), atx.score())
        })
        .collect();
    mempool_stack.sort_unstable_by(|a, b| partial_cmp_uid_score(*a, *b).expect("Not NaN"));
    let mut mempool_stack: Vec<u32> = mempool_stack.into_iter().map(|(txid, _, _)| txid).collect();

    info!("Building blocks by greedily choosing the highest feerate package");
    info!("(i.e. the package rooted in the transaction with the best ancestor score)");
    let mut blocks: Vec<Vec<u32>> = Vec::new();
    let mut block_weight: u32 = BLOCK_RESERVED_WEIGHT;
    let mut block_sigops: u32 = BLOCK_RESERVED_SIGOPS;
    // No need to be bigger than 4096 transactions for the per-block transaction Vec.
    let initial_txes_per_block: usize = 4096.min(mempool_len);
    let mut transactions: Vec<u32> = Vec::with_capacity(initial_txes_per_block);
    let mut modified: ModifiedQueue = u32priority_queue_with_capacity(mempool_len);
    let mut overflow: Vec<u32> = Vec::new();
    let mut failures = 0;
    while !mempool_stack.is_empty() || !modified.is_empty() {
        // This trace log storm is big, so to make scrolling through
        // Each iteration easier, leaving a bunch of empty rows
        // And a header of ======
        trace!("\n\n\n\n\n\n\n\n\n\n==================================");
        trace!("mempool_array: {:#?}", mempool_stack);
        trace!("clusters: {:#?}", clusters);
        trace!("modified: {:#?}", modified);
        trace!("audit_pool: {:#?}", audit_pool);
        trace!("blocks: {:#?}", blocks);
        trace!("block_weight: {:#?}", block_weight);
        trace!("block_sigops: {:#?}", block_sigops);
        trace!("transactions: {:#?}", transactions);
        trace!("overflow: {:#?}", overflow);
        trace!("failures: {:#?}", failures);
        trace!("\n==================================");

        let next_from_stack = next_valid_from_stack(&mut mempool_stack, &audit_pool);
        let next_from_queue = next_valid_from_queue(&mut modified, &audit_pool);
        if next_from_stack.is_none() && next_from_queue.is_none() {
            info!("No transactions left! {:#?} in overflow", overflow.len());
        } else {
            let (next_tx, from_stack) = match (next_from_stack, next_from_queue) {
                (Some(stack_tx), Some(queue_tx)) => match queue_tx.cmp(stack_tx) {
                    std::cmp::Ordering::Less => (stack_tx, true),
                    _ => (queue_tx, false),
                },
                (Some(stack_tx), None) => (stack_tx, true),
                (None, Some(queue_tx)) => (queue_tx, false),
                (None, None) => unreachable!(),
            };

            if from_stack {
                mempool_stack.pop();
            } else {
                modified.pop();
            }

            if blocks.len() < (max_blocks - 1)
                && ((block_weight + (4 * next_tx.ancestor_sigop_adjusted_vsize())
                    >= max_block_weight - 4_000)
                    || (block_sigops + next_tx.ancestor_sigops() > BLOCK_SIGOPS))
            {
                // hold this package in an overflow list while we check for smaller options
                overflow.push(next_tx.uid);
                failures += 1;
            } else {
                let mut package: Vec<(u32, u32, usize)> = Vec::new();
                let mut cluster: Vec<u32> = Vec::new();
                let is_cluster: bool = !next_tx.ancestors.is_empty();
                for ancestor_id in &next_tx.ancestors {
                    if let Some(Some(ancestor)) = audit_pool.get(*ancestor_id as usize) {
                        package.push((*ancestor_id, ancestor.order(), ancestor.ancestors.len()));
                    }
                }
                package.sort_unstable_by(|a, b| -> Ordering {
                    if a.2 != b.2 {
                        // order by ascending ancestor count
                        a.2.cmp(&b.2)
                    } else if a.1 != b.1 {
                        // tie-break by ascending partial txid
                        a.1.cmp(&b.1)
                    } else {
                        // tie-break partial txid collisions by ascending uid
                        a.0.cmp(&b.0)
                    }
                });
                package.push((next_tx.uid, next_tx.order(), next_tx.ancestors.len()));

                let cluster_rate = next_tx.cluster_rate();

                for (txid, _, _) in &package {
                    cluster.push(*txid);
                    if let Some(Some(tx)) = audit_pool.get_mut(*txid as usize) {
                        tx.used = true;
                        tx.set_dirty_if_different(cluster_rate);
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
        }

        // this block is full
        let exceeded_package_tries =
            failures > 1000 && block_weight > (max_block_weight - 4_000 - BLOCK_RESERVED_WEIGHT);
        let queue_is_empty = mempool_stack.is_empty() && modified.is_empty();
        if (exceeded_package_tries || queue_is_empty) && blocks.len() < (max_blocks - 1) {
            // finalize this block
            if transactions.is_empty() {
                info!("trying to push an empty block! breaking loop! mempool {:#?} | modified {:#?} | overflow {:#?}", mempool_stack.len(), modified.len(), overflow.len());
                break;
            }

            blocks.push(transactions);
            block_weights.push(block_weight);

            // reset for the next block
            transactions = Vec::with_capacity(initial_txes_per_block);
            block_weight = BLOCK_RESERVED_WEIGHT;
            block_sigops = BLOCK_RESERVED_SIGOPS;
            failures = 0;
            // 'overflow' packages didn't fit in this block, but are valid candidates for the next
            overflow.reverse();
            for overflowed in &overflow {
                if let Some(Some(overflowed_tx)) = audit_pool.get(*overflowed as usize) {
                    if overflowed_tx.modified {
                        modified.push(
                            *overflowed,
                            TxPriority {
                                uid: *overflowed,
                                order: overflowed_tx.order(),
                                score: overflowed_tx.score(),
                            },
                        );
                    } else {
                        mempool_stack.push(*overflowed);
                    }
                }
            }
            overflow = Vec::new();
        }
    }
    info!("add the final unbounded block if it contains any transactions");
    if !transactions.is_empty() {
        blocks.push(transactions);
        block_weights.push(block_weight);
    }

    info!("make a list of dirty transactions and their new rates");
    let mut rates: Vec<Vec<f64>> = Vec::new();
    for (uid, thread_tx) in mempool {
        // Takes ownership of the audit_tx and replaces with None
        if let Some(Some(audit_tx)) = audit_pool.get_mut(*uid as usize).map(Option::take) {
            trace!("txid: {}, is_dirty: {}", uid, audit_tx.dirty);
            if audit_tx.dirty {
                rates.push(vec![f64::from(*uid), audit_tx.effective_fee_per_vsize]);
                thread_tx.effective_fee_per_vsize = audit_tx.effective_fee_per_vsize;
            }
            // Drops the AuditTransaction manually
            // There are no audit_txs that are not in the mempool HashMap
            // So there is guaranteed to be no memory leaks.
            ManuallyDrop::into_inner(audit_tx);
        }
    }
    trace!("\n\n\n\n\n====================");
    trace!("blocks: {:#?}", blocks);
    trace!("clusters: {:#?}", clusters);
    trace!("rates: {:#?}\n====================\n\n\n\n\n", rates);

    GbtResult {
        blocks,
        block_weights,
        clusters,
        rates,
        overflow,
    }
}

fn next_valid_from_stack<'a>(
    mempool_stack: &mut Vec<u32>,
    audit_pool: &'a AuditPool,
) -> Option<&'a AuditTransaction> {
    while let Some(next_txid) = mempool_stack.last() {
        match audit_pool.get(*next_txid as usize) {
            Some(Some(tx)) if !tx.used && !tx.modified => {
                return Some(tx);
            }
            _ => {
                mempool_stack.pop();
            }
        }
    }
    None
}

fn next_valid_from_queue<'a>(
    queue: &mut ModifiedQueue,
    audit_pool: &'a AuditPool,
) -> Option<&'a AuditTransaction> {
    while let Some((next_txid, _)) = queue.peek() {
        match audit_pool.get(*next_txid as usize) {
            Some(Some(tx)) if !tx.used => {
                return Some(tx);
            }
            _ => {
                queue.pop();
            }
        }
    }
    None
}

fn set_relatives(txid: u32, audit_pool: &mut AuditPool) {
    let mut parents: HashSet<u32, U32HasherState> = u32hashset_new();
    if let Some(Some(tx)) = audit_pool.get(txid as usize) {
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

        if let Some(Some(parent)) = audit_pool.get_mut(*parent_id as usize) {
            // Safety: ancestors must always contain only txes in audit_pool
            ancestors.insert(*parent_id);
            parent.children.insert(txid);
            for ancestor in &parent.ancestors {
                ancestors.insert(*ancestor);
            }
        }
    }

    let mut total_fee: u64 = 0;
    let mut total_sigop_adjusted_weight: u32 = 0;
    let mut total_sigop_adjusted_vsize: u32 = 0;
    let mut total_sigops: u32 = 0;

    for ancestor_id in &ancestors {
        if let Some(ancestor) = audit_pool
            .get(*ancestor_id as usize)
            .expect("audit_pool contains all ancestors")
        {
            total_fee += ancestor.fee;
            total_sigop_adjusted_weight += ancestor.sigop_adjusted_weight;
            total_sigop_adjusted_vsize += ancestor.sigop_adjusted_vsize;
            total_sigops += ancestor.sigops;
        } else { todo!() };
    }

    if let Some(Some(tx)) = audit_pool.get_mut(txid as usize) {
        tx.set_ancestors(
            ancestors,
            total_fee,
            total_sigop_adjusted_weight,
            total_sigop_adjusted_vsize,
            total_sigops,
        );
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
    let root_sigop_adjusted_weight: u32;
    let root_sigop_adjusted_vsize: u32;
    let root_sigops: u32;
    if let Some(Some(root_tx)) = audit_pool.get(root_txid as usize) {
        for descendant_id in &root_tx.children {
            if !visited.contains(descendant_id) {
                descendant_stack.push(*descendant_id);
                visited.insert(*descendant_id);
            }
        }
        root_fee = root_tx.fee;
        root_sigop_adjusted_weight = root_tx.sigop_adjusted_weight;
        root_sigop_adjusted_vsize = root_tx.sigop_adjusted_vsize;
        root_sigops = root_tx.sigops;
    } else {
        return;
    }
    while let Some(next_txid) = descendant_stack.pop() {
        if let Some(Some(descendant)) = audit_pool.get_mut(next_txid as usize) {
            // remove root tx as ancestor
            let old_score = descendant.remove_root(
                root_txid,
                root_fee,
                root_sigop_adjusted_weight,
                root_sigop_adjusted_vsize,
                root_sigops,
                cluster_rate,
            );
            // add to priority queue or update priority if score has changed
            if descendant.score() < old_score {
                descendant.modified = true;
                modified.push_decrease(
                    descendant.uid,
                    TxPriority {
                        uid: descendant.uid,
                        order: descendant.order(),
                        score: descendant.score(),
                    },
                );
            } else if descendant.score() > old_score {
                descendant.modified = true;
                modified.push_increase(
                    descendant.uid,
                    TxPriority {
                        uid: descendant.uid,
                        order: descendant.order(),
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
