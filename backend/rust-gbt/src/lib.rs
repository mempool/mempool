use napi::bindgen_prelude::*;
use napi_derive::napi;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use utils::U32HasherState;

mod audit_transaction;
mod gbt;
mod thread_transaction;
mod utils;
use thread_transaction::ThreadTransaction;

type ThreadTransactionsMap = HashMap<u32, ThreadTransaction, U32HasherState>;

#[napi]
pub struct GbtGenerator {
    thread_transactions: Arc<Mutex<ThreadTransactionsMap>>,
}

#[napi]
impl GbtGenerator {
    #[napi(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self {
            thread_transactions: Arc::new(Mutex::new(HashMap::with_capacity_and_hasher(
                2048,
                U32HasherState,
            ))),
        }
    }

    #[napi]
    pub async fn make(&self, mempool_buffer: Uint8Array) -> Result<GbtResult> {
        run_task(Arc::clone(&self.thread_transactions), move |map| {
            for tx in ThreadTransaction::batch_from_buffer(&mempool_buffer) {
                map.insert(tx.uid, tx);
            }
        })
        .await
    }

    #[napi]
    pub async fn update(&self, new_txs: Uint8Array, remove_txs: Uint8Array) -> Result<GbtResult> {
        run_task(Arc::clone(&self.thread_transactions), move |map| {
            for tx in ThreadTransaction::batch_from_buffer(&new_txs) {
                map.insert(tx.uid, tx);
            }
            for txid in &utils::txids_from_buffer(&remove_txs) {
                map.remove(txid);
            }
        })
        .await
    }
}

/// The result from calling the gbt function.
///
/// This tuple contains the following:
///   blocks: A 2D Vector of transaction IDs (u32), the inner Vecs each represent a block.
/// clusters: A 2D Vector of transaction IDs representing clusters of dependent mempool transactions
///    rates: A Vector of tuples containing transaction IDs (u32) and effective fee per vsize (f64)
#[napi(constructor)]
pub struct GbtResult {
    pub blocks: Vec<Vec<u32>>,
    pub clusters: Vec<Vec<u32>>,
    pub rates: Vec<Vec<f64>>, // Tuples not supported. u32 fits inside f64
}

/// All on another thread, this runs an arbitrary task in between
/// taking the lock and running gbt.
///
/// Rather than filling / updating the HashMap on the main thread,
/// this allows for HashMap modifying tasks to be run before running and returning gbt results.
///
/// `thread_transactions` is a cloned Arc of the Mutex for the HashMap state.
/// `callback` is a `'static + Send` `FnOnce` closure/function that takes a mutable reference
/// to the HashMap as the only argument. (A move closure is recommended to meet the bounds)
async fn run_task<F>(
    thread_transactions: Arc<Mutex<ThreadTransactionsMap>>,
    callback: F,
) -> Result<GbtResult>
where
    F: FnOnce(&mut ThreadTransactionsMap) + Send + 'static,
{
    let handle = napi::tokio::task::spawn_blocking(move || {
        let mut map = thread_transactions
            .lock()
            .map_err(|_| napi::Error::from_reason("THREAD_TRANSACTIONS Mutex poisoned"))?;
        callback(&mut map);
        gbt::gbt(&mut map).ok_or_else(|| napi::Error::from_reason("gbt failed"))
    });

    handle
        .await
        .map_err(|_| napi::Error::from_reason("thread panicked"))?
}
