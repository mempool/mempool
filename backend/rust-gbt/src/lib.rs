use napi::bindgen_prelude::*;
use napi_derive::napi;

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;

mod audit_transaction;
mod gbt;
mod thread_transaction;
mod utils;
use thread_transaction::ThreadTransaction;

static THREAD_TRANSACTIONS: Lazy<Mutex<HashMap<u32, ThreadTransaction>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[napi(ts_args_type = "mempoolBuffer: Uint8Array")]
pub async fn make(mempool_buffer: Uint8Array) -> Result<GbtResult> {
    let mut map = HashMap::new();
    for tx in ThreadTransaction::batch_from_buffer(&mempool_buffer) {
        map.insert(tx.uid, tx);
    }

    {
        let mut global_map = THREAD_TRANSACTIONS
            .lock()
            .map_err(|_| napi::Error::from_reason("THREAD_TRANSACTIONS Mutex poisoned"))?;
        *global_map = map;
    }

    run_in_thread().await
}

#[napi(ts_args_type = "newTxs: Uint8Array, removeTxs: Uint8Array")]
pub async fn update(new_txs: Uint8Array, remove_txs: Uint8Array) -> Result<GbtResult> {
    {
        let mut map = THREAD_TRANSACTIONS
            .lock()
            .map_err(|_| napi::Error::from_reason("THREAD_TRANSACTIONS Mutex poisoned"))?;
        for tx in ThreadTransaction::batch_from_buffer(&new_txs) {
            map.insert(tx.uid, tx);
        }
        for txid in &utils::txids_from_buffer(&remove_txs) {
            map.remove(txid);
        }
    }

    run_in_thread().await
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

async fn run_in_thread() -> Result<GbtResult> {
    let handle = napi::tokio::task::spawn_blocking(move || {
        let mut map = THREAD_TRANSACTIONS
            .lock()
            .map_err(|_| napi::Error::from_reason("THREAD_TRANSACTIONS Mutex poisoned"))?;
        gbt::gbt(&mut map).ok_or_else(|| napi::Error::from_reason("gbt failed"))
    });

    handle
        .await
        .map_err(|_| napi::Error::from_reason("thread panicked"))?
}
