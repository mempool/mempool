use std::cmp::Ordering;
use std::collections::{HashMap, HashSet, VecDeque};
use std::f64::INFINITY;
use priority_queue::PriorityQueue;

use crate::thread_transaction::{ThreadTransaction};
use crate::audit_transaction::{AuditTransaction};

const BLOCK_WEIGHT_UNITS: u32 = 4_000_000;
const BLOCK_SIGOPS: u32 = 80_000;

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
  fn partial_cmp(&self, other: &TxPriority) -> Option<Ordering> {
    if self.score == other.score {
      return Some(self.uid.cmp(&other.uid));
    } else {
      return other.score.partial_cmp(&self.score);
    }
  }
}
impl Ord for TxPriority {
  fn cmp(&self, other: &Self) -> Ordering {
    self.partial_cmp(other).unwrap()
  }
}

pub fn gbt(mempool: &mut HashMap<u32,ThreadTransaction>) -> (Vec<Vec<u32>>, Vec<(u32, f64)>, Vec<Vec<u32>>) {
  return make_block_templates(mempool);
}

/*
* Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core
* (see BlockAssembler in https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp)
* Ported from https://github.com/mempool/mempool/blob/master/backend/src/api/tx-selection-worker.ts
*/
fn make_block_templates(mempool: &mut HashMap<u32,ThreadTransaction>) -> (Vec<Vec<u32>>, Vec<(u32, f64)>, Vec<Vec<u32>>) {
  let mut audit_pool: HashMap<u32, AuditTransaction> = HashMap::new();
  let mut mempool_array: VecDeque<u32> = VecDeque::new();
  let mut cluster_array: Vec<Vec<u32>> = Vec::new();

  // Initialize working structs
  for (uid, tx) in mempool {
    let audit_tx = AuditTransaction {
      uid: tx.uid,
      fee: tx.fee,
      weight: tx.weight,
      sigops: tx.sigops,
      fee_per_vsize: tx.fee_per_vsize,
      effective_fee_per_vsize: tx.effective_fee_per_vsize,
      dependency_rate: INFINITY,
      inputs: tx.inputs.clone(),
      is_relatives_set: false,
      ancestors: HashSet::new(),
      children: HashSet::new(),
      ancestor_fee: tx.fee,
      ancestor_weight: tx.weight,
      ancestor_sigops: tx.sigops,
      score: 0.0,
      used: false,
      modified: false,
      dirty: false,
    };
    audit_pool.insert(audit_tx.uid, audit_tx);
    mempool_array.push_back(*uid);
  }

  // Build relatives graph & calculate ancestor scores
  for txid in &mempool_array {
    set_relatives(*txid, &mut audit_pool);
  }

  // Sort by descending ancestor score
  mempool_array.make_contiguous().sort_unstable_by(|a, b| {
    let a_tx = audit_pool.get(a).unwrap();
    let b_tx = audit_pool.get(b).unwrap();
    b_tx.cmp(a_tx)
  });

  // Build blocks by greedily choosing the highest feerate package
  // (i.e. the package rooted in the transaction with the best ancestor score)
  let mut blocks: Vec<Vec<u32>> = Vec::new();
  let mut block_weight: u32 = 4000;
  let mut block_sigops: u32 = 0;
  let mut transactions: Vec<u32> = Vec::new();
  let mut modified: PriorityQueue<u32, TxPriority> = PriorityQueue::new();
  let mut overflow: Vec<u32> = Vec::new();
  let mut failures = 0;
  while mempool_array.len() > 0 || !modified.is_empty() {
    let next_txid: u32;
    if modified.is_empty() {
      next_txid = mempool_array.pop_front().unwrap();
    } else if mempool_array.len() == 0 {
      next_txid = modified.pop().unwrap().0;
    } else {
      let next_array_txid = mempool_array.front().unwrap();
      let next_modified_txid = modified.peek().unwrap().0;
      let array_tx: &AuditTransaction = audit_pool.get(next_array_txid).unwrap();
      let modified_tx: &AuditTransaction = audit_pool.get(next_modified_txid).unwrap();
      match array_tx.cmp(&modified_tx) {
        std::cmp::Ordering::Equal | std::cmp::Ordering::Greater => {
          next_txid = mempool_array.pop_front().unwrap();
        }
        std::cmp::Ordering::Less => {
          next_txid = modified.pop().unwrap().0;
        }
      }
    }
    let next_tx: AuditTransaction = audit_pool.get(&next_txid).unwrap().clone();
    
    if next_tx.used {
      continue;
    }

    if blocks.len() < 7 && ((block_weight + next_tx.ancestor_weight >= BLOCK_WEIGHT_UNITS) || (block_sigops + next_tx.ancestor_sigops > BLOCK_SIGOPS)) {
      // hold this package in an overflow list while we check for smaller options
      overflow.push(next_txid);
      failures += 1;
    } else {
      let mut package: Vec<(u32, usize, u32)> = Vec::new();
      let mut cluster: Vec<u32> = Vec::new();
      let is_cluster: bool = next_tx.ancestors.len() > 0;
      package.push((next_tx.uid, next_tx.ancestors.len(), next_tx.weight));
      cluster.push(next_tx.uid);
      for ancestor_id in &next_tx.ancestors {
        if let Some(ancestor) = audit_pool.get(ancestor_id) {
          package.push((*ancestor_id, ancestor.ancestors.len(), ancestor.weight));
          cluster.push(*ancestor_id);
        }
      }
      package.sort_unstable_by_key(|a| 0 - a.1);

      if is_cluster {
        cluster_array.push(cluster);
      }

      let cluster_rate = next_tx.dependency_rate.min(next_tx.ancestor_fee as f64 / (next_tx.ancestor_weight as f64 / 4.0));

      for package_entry in &package {
        if let Some(tx) = audit_pool.get_mut(&package_entry.0) {
          tx.used = true;
          if tx.effective_fee_per_vsize != cluster_rate {
            tx.effective_fee_per_vsize = cluster_rate;
            tx.dirty = true;
          }
          transactions.push(tx.uid);
          block_weight += tx.weight;
          block_sigops += tx.sigops;
        }
        update_descendants(package_entry.0, &mut audit_pool, &mut modified, cluster_rate);
      }

      failures = 0;
    }

    // this block is full
    let exceeded_package_tries = failures > 1000 && block_weight > (BLOCK_WEIGHT_UNITS - 4000);
    let queue_is_empty = mempool_array.len() == 0 && modified.is_empty();
    if (exceeded_package_tries || queue_is_empty) && blocks.len() < 7 {
      // finalize this block
      if transactions.len() > 0 {
        blocks.push(transactions);
      }
      // reset for the next block
      transactions = Vec::new();
      block_weight = 4000;
      // 'overflow' packages didn't fit in this block, but are valid candidates for the next
      overflow.reverse();
      for overflowed in &overflow {
        if let Some(overflowed_tx) = audit_pool.get(overflowed) {
          if overflowed_tx.modified {
            modified.push(*overflowed, TxPriority{ uid: *overflowed, score: overflowed_tx.score});
          } else {
            mempool_array.push_front(*overflowed);
          }
        }
      }
      overflow = Vec::new();
    }
  }
  // add the final unbounded block if it contains any transactions
  if transactions.len() > 0 {
    blocks.push(transactions);
  }

  // make a list of dirty transactions and their new rates
  let mut rates: Vec<(u32, f64)> = Vec::new();
  for (txid, tx) in audit_pool {
    if tx.dirty {
      rates.push((txid, tx.effective_fee_per_vsize));
    }
  }

  return (blocks, rates, cluster_array);
}

fn set_relatives(txid: u32, audit_pool: &mut HashMap<u32, AuditTransaction>) {
  let mut parents: HashSet<u32> = HashSet::new();
  if let Some(tx) = audit_pool.get(&txid) {
    if tx.is_relatives_set {
      return;
    }
    for input in &tx.inputs {
      parents.insert(*input);
    }
  } else {
    return;
  }

  let mut ancestors: HashSet<u32> = HashSet::new();
  for parent_id in &parents {
    set_relatives(*parent_id, audit_pool);

    let parent_entry: Option<&mut AuditTransaction> = audit_pool.get_mut(&parent_id);
    match parent_entry {
      Some(parent) => {
        ancestors.insert(*parent_id);
        parent.children.insert(txid);
        for ancestor in &parent.ancestors {
          ancestors.insert(*ancestor);
        }
      }

      None => {}
    }
  }

  let mut total_fee: u64 = 0;
  let mut total_weight: u32 = 0;
  let mut total_sigops: u32 = 0;

  for ancestor_id in &ancestors {
    let ancestor = audit_pool.get(&ancestor_id).unwrap();
    total_fee += ancestor.fee;
    total_weight += ancestor.weight;
    total_sigops += ancestor.sigops;
  }

  if let Some(tx) = audit_pool.get_mut(&txid) {
    tx.ancestors = ancestors;
    tx.ancestor_fee = tx.fee + total_fee;
    tx.ancestor_weight = tx.weight + total_weight;
    tx.ancestor_sigops = tx.sigops + total_sigops;
    tx.score = (tx.ancestor_fee as f64) / (if tx.ancestor_weight != 0 {tx.ancestor_weight as f64 / 4.0} else { 1.0 });
    tx.is_relatives_set = true;
  }
}

// iterate over remaining descendants, removing the root as a valid ancestor & updating the ancestor score
fn update_descendants(root_txid: u32, audit_pool: &mut HashMap<u32, AuditTransaction>, modified: &mut PriorityQueue<u32, TxPriority>, cluster_rate: f64) {
  let mut visited: HashSet<u32> = HashSet::new();
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
  while descendant_stack.len() > 0 {
    let next_txid: u32 = descendant_stack.pop().unwrap();
    if let Some(descendant) = audit_pool.get_mut(&next_txid) {
      // remove root tx as ancestor
      descendant.ancestors.remove(&root_txid);
      descendant.ancestor_fee -= root_fee;
      descendant.ancestor_weight -= root_weight;
      descendant.ancestor_sigops -= root_sigops;
      let current_score = descendant.score;
      descendant.score = (descendant.ancestor_fee as f64) / (if descendant.ancestor_weight != 0 {descendant.ancestor_weight as f64 / 4.0} else { 1.0 });
      descendant.dependency_rate = descendant.dependency_rate.min(cluster_rate);
      descendant.modified = true;
      // update modified priority if score has changed
      if !descendant.modified || descendant.score < current_score {
        modified.push_decrease(descendant.uid, TxPriority { uid: descendant.uid, score: descendant.score});
      } else if descendant.score > current_score {
        modified.push_increase(descendant.uid, TxPriority { uid: descendant.uid, score: descendant.score});
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