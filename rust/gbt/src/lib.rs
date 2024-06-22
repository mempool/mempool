#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![warn(clippy::nursery)]
#![allow(clippy::cast_precision_loss)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::cast_sign_loss)]
#![allow(clippy::float_cmp)]

use napi::bindgen_prelude::Result;
use napi_derive::napi;
use thread_transaction::ThreadTransaction;
use thread_acceleration::ThreadAcceleration;
use tracing::{debug, info, trace};
use tracing_log::LogTracer;
use tracing_subscriber::{EnvFilter, FmtSubscriber};

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

mod audit_transaction;
mod gbt;
mod thread_transaction;
mod thread_acceleration;
mod u32_hasher_types;

use u32_hasher_types::{u32hashmap_with_capacity, U32HasherState};

/// This is the initial capacity of the `GbtGenerator` struct's inner `HashMap`.
///
/// Note: This doesn't *have* to be a power of 2. (uwu)
const STARTING_CAPACITY: usize = 1_048_576;

type ThreadTransactionsMap = HashMap<u32, ThreadTransaction, U32HasherState>;

#[napi]
pub struct GbtGenerator {
    thread_transactions: Arc<Mutex<ThreadTransactionsMap>>,
    max_block_weight: u32,
    max_blocks: usize,
}

#[napi::module_init]
fn init() {
    // Set all `tracing` logs to print to STDOUT
    // Note: Passing RUST_LOG env variable to the node process
    //       will change the log level for the rust module.
    tracing::subscriber::set_global_default(
        FmtSubscriber::builder()
            .with_env_filter(EnvFilter::from_default_env())
            .with_ansi(
                // Default to no-color logs.
                // Setting RUST_LOG_COLOR to 1 or true|TRUE|True etc.
                // will enable color
                std::env::var("RUST_LOG_COLOR")
                    .map(|s| ["1", "true"].contains(&&*s.to_lowercase()))
                    .unwrap_or(false),
            )
            .finish(),
    )
    .expect("Logging subscriber failed");
    // Convert all `log` logs into `tracing` events
    LogTracer::init().expect("Legacy log subscriber failed");
}

#[napi]
impl GbtGenerator {
    #[napi(constructor)]
    #[allow(clippy::new_without_default)]
    #[must_use]
    pub fn new(max_block_weight: u32, max_blocks: u32) -> Self {
        debug!("Created new GbtGenerator");
        Self {
            thread_transactions: Arc::new(Mutex::new(u32hashmap_with_capacity(STARTING_CAPACITY))),
            max_block_weight,
            max_blocks: max_blocks as usize,
        }
    }

    /// # Errors
    ///
    /// Rejects if the thread panics or if the Mutex is poisoned.
    #[napi]
    pub async fn make(
        &self,
        mempool: Vec<ThreadTransaction>,
        accelerations: Vec<ThreadAcceleration>,
        max_uid: u32,
    ) -> Result<GbtResult> {
        trace!("make: Current State {:#?}", self.thread_transactions);
        run_task(
            Arc::clone(&self.thread_transactions),
            accelerations,
            max_uid as usize,
            self.max_block_weight,
            self.max_blocks,
            move |map| {
                for tx in mempool {
                    map.insert(tx.uid, tx);
                }
            },
        )
        .await
    }

    /// # Errors
    ///
    /// Rejects if the thread panics or if the Mutex is poisoned.
    #[napi]
    pub async fn update(
        &self,
        new_txs: Vec<ThreadTransaction>,
        remove_txs: Vec<u32>,
        accelerations: Vec<ThreadAcceleration>,
        max_uid: u32,
    ) -> Result<GbtResult> {
        trace!("update: Current State {:#?}", self.thread_transactions);
        run_task(
            Arc::clone(&self.thread_transactions),
            accelerations,
            max_uid as usize,
            self.max_block_weight,
            self.max_blocks,
            move |map| {
                for tx in new_txs {
                    map.insert(tx.uid, tx);
                }
                for txid in &remove_txs {
                    map.remove(txid);
                }
            },
        )
        .await
    }
}

/// The result from calling the gbt function.
///
/// This tuple contains the following:
///        blocks: A 2D Vector of transaction IDs (u32), the inner Vecs each represent a block.
/// block_weights: A Vector of total weights per block.
///      clusters: A 2D Vector of transaction IDs representing clusters of dependent mempool transactions
///         rates: A Vector of tuples containing transaction IDs (u32) and effective fee per vsize (f64)
#[napi(constructor)]
pub struct GbtResult {
    pub blocks: Vec<Vec<u32>>,
    pub block_weights: Vec<u32>,
    pub clusters: Vec<Vec<u32>>,
    pub rates: Vec<Vec<f64>>, // Tuples not supported. u32 fits inside f64
    pub overflow: Vec<u32>,
}

/// All on another thread, this runs an arbitrary task in between
/// taking the lock and running gbt.
///
/// Rather than filling / updating the `HashMap` on the main thread,
/// this allows for `HashMap` modifying tasks to be run before running and returning gbt results.
///
/// `thread_transactions` is a cloned `Arc` of the `Mutex` for the `HashMap` state.
/// `callback` is a `'static + Send` `FnOnce` closure/function that takes a mutable reference
/// to the `HashMap` as the only argument. (A move closure is recommended to meet the bounds)
async fn run_task<F>(
    thread_transactions: Arc<Mutex<ThreadTransactionsMap>>,
    accelerations: Vec<ThreadAcceleration>,
    max_uid: usize,
    max_block_weight: u32,
    max_blocks: usize,
    callback: F,
) -> Result<GbtResult>
where
    F: FnOnce(&mut ThreadTransactionsMap) + Send + 'static,
{
    debug!("Spawning thread...");
    let handle = napi::tokio::task::spawn_blocking(move || {
        debug!(
            "Getting lock for thread_transactions from thread {:?}...",
            std::thread::current().id()
        );
        let mut map = thread_transactions
            .lock()
            .map_err(|_| napi::Error::from_reason("THREAD_TRANSACTIONS Mutex poisoned"))?;
        callback(&mut map);

        info!("Starting gbt algorithm for {} elements...", map.len());
        let result = gbt::gbt(
            &mut map,
            &accelerations,
            max_uid,
            max_block_weight,
            max_blocks as usize,
        );
        info!("Finished gbt algorithm for {} elements...", map.len());

        debug!(
            "Releasing lock for thread_transactions from thread {:?}...",
            std::thread::current().id()
        );
        drop(map);

        Ok(result)
    });

    handle
        .await
        .map_err(|_| napi::Error::from_reason("thread panicked"))?
}
