use std::{collections::{HashSet}, hash::{Hash, Hasher}, cmp::Ordering};

#[derive(Clone)]
pub struct AuditTransaction {
  pub uid: u32,
  pub fee: u64,
  pub weight: u32,
  pub sigops: u32,
  pub fee_per_vsize: f64,
  pub effective_fee_per_vsize: f64,
  pub dependency_rate: f64,
  pub inputs: Vec<u32>,
  pub is_relatives_set: bool,
  pub ancestors: HashSet<u32>,
  pub children: HashSet<u32>,
  pub ancestor_fee: u64,
  pub ancestor_weight: u32,
  pub ancestor_sigops: u32,
  pub score: f64,
  pub used: bool,
  pub modified: bool,
  pub dirty: bool,
}

impl Hash for AuditTransaction {
  fn hash<H: Hasher>(&self, state: &mut H) {
      self.uid.hash(state);
  }
}

impl PartialEq for AuditTransaction {
  fn eq(&self, other: &Self) -> bool {
    self.uid == other.uid
  }
}

impl Eq for AuditTransaction {}

impl PartialOrd for AuditTransaction {
  fn partial_cmp(&self, other: &AuditTransaction) -> Option<Ordering> {
    if self.score == other.score {
      return Some(self.uid.cmp(&other.uid));
    } else {
      return self.score.partial_cmp(&other.score);
    }
  }
}

impl Ord for AuditTransaction {
  fn cmp(&self, other: &AuditTransaction) -> Ordering {
    self.partial_cmp(other).unwrap()
  }
}