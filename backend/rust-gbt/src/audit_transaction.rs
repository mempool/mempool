use crate::{
    thread_transaction::ThreadTransaction,
    u32_hasher_types::{u32hashset_new, U32HasherState},
};
use std::{
    cmp::Ordering,
    collections::HashSet,
    hash::{Hash, Hasher},
};

#[allow(clippy::struct_excessive_bools)]
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
    pub ancestors: HashSet<u32, U32HasherState>,
    pub children: HashSet<u32, U32HasherState>,
    pub ancestor_fee: u64,
    pub ancestor_weight: u32,
    pub ancestor_sigops: u32,
    // Safety: Must be private to prevent NaN breaking Ord impl.
    score: f64,
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
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // If either score is NaN, this is false,
        // and partial_cmp will return None
        if self.score == other.score {
            Some(self.uid.cmp(&other.uid))
        } else {
            self.score.partial_cmp(&other.score)
        }
    }
}

impl Ord for AuditTransaction {
    fn cmp(&self, other: &Self) -> Ordering {
        // Safety: The only possible values for score are f64
        // that are not NaN. This is because outside code can not
        // freely assign score. Also, calc_new_score guarantees no NaN.
        self.partial_cmp(other).expect("score will never be NaN")
    }
}

impl AuditTransaction {
    pub fn from_thread_transaction(tx: &ThreadTransaction) -> Self {
        Self {
            uid: tx.uid,
            fee: tx.fee,
            weight: tx.weight,
            sigops: tx.sigops,
            fee_per_vsize: tx.fee_per_vsize,
            effective_fee_per_vsize: tx.effective_fee_per_vsize,
            dependency_rate: f64::INFINITY,
            inputs: tx.inputs.clone(),
            relatives_set_flag: false,
            ancestors: u32hashset_new(),
            children: u32hashset_new(),
            ancestor_fee: tx.fee,
            ancestor_weight: tx.weight,
            ancestor_sigops: tx.sigops,
            score: 0.0,
            used: false,
            modified: false,
            dirty: false,
        }
    }

    #[inline]
    pub const fn score(&self) -> f64 {
        self.score
    }

    /// Safety: This function must NEVER set score to NaN.
    #[inline]
    fn calc_new_score(&mut self) {
        self.score = (self.ancestor_fee as f64)
            / (if self.ancestor_weight == 0 {
                1.0
            } else {
                f64::from(self.ancestor_weight) / 4.0
            });
    }

    #[inline]
    pub fn set_ancestors(
        &mut self,
        ancestors: HashSet<u32, U32HasherState>,
        total_fee: u64,
        total_weight: u32,
        total_sigops: u32,
    ) {
        self.ancestors = ancestors;
        self.ancestor_fee = self.fee + total_fee;
        self.ancestor_weight = self.weight + total_weight;
        self.ancestor_sigops = self.sigops + total_sigops;
        self.calc_new_score();
        self.relatives_set_flag = true;
    }

    #[inline]
    pub fn remove_root(
        &mut self,
        root_txid: u32,
        root_fee: u64,
        root_weight: u32,
        root_sigops: u32,
        cluster_rate: f64,
    ) -> f64 {
        self.ancestors.remove(&root_txid);
        self.ancestor_fee -= root_fee;
        self.ancestor_weight -= root_weight;
        self.ancestor_sigops -= root_sigops;
        let old_score = self.score();
        self.calc_new_score();
        self.dependency_rate = self.dependency_rate.min(cluster_rate);
        self.modified = true;
        old_score
    }
}
