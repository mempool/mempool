use crate::thread_transaction::ThreadTransaction;
use std::{
    cmp::Ordering,
    collections::HashSet,
    hash::{Hash, Hasher},
};

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
    pub relatives_set_flag: bool,
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
            Some(self.uid.cmp(&other.uid))
        } else {
            self.score.partial_cmp(&other.score)
        }
    }
}

impl Ord for AuditTransaction {
    fn cmp(&self, other: &AuditTransaction) -> Ordering {
        self.partial_cmp(other).unwrap()
    }
}

impl AuditTransaction {
    pub fn from_thread_transaction(tx: &ThreadTransaction) -> Self {
        AuditTransaction {
            uid: tx.uid,
            fee: tx.fee,
            weight: tx.weight,
            sigops: tx.sigops,
            fee_per_vsize: tx.fee_per_vsize,
            effective_fee_per_vsize: tx.effective_fee_per_vsize,
            dependency_rate: f64::INFINITY,
            inputs: tx.inputs.clone(),
            relatives_set_flag: false,
            ancestors: HashSet::new(),
            children: HashSet::new(),
            ancestor_fee: tx.fee,
            ancestor_weight: tx.weight,
            ancestor_sigops: tx.sigops,
            score: 0.0,
            used: false,
            modified: false,
            dirty: false,
        }
    }
}
