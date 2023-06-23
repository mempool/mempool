use neon::{prelude::*, types::buffer::TypedArray};
use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Mutex;
use once_cell::sync::Lazy;

mod gbt;
mod thread_transaction;
mod audit_transaction;
mod utils;
use thread_transaction::ThreadTransaction;

static THREAD_TRANSACTIONS: Lazy<Mutex<HashMap<u32, ThreadTransaction>>> = Lazy::new(|| {
  Mutex::new(HashMap::new())
});

fn make(mut cx: FunctionContext) -> JsResult<JsUndefined> {
  let mempool_arg = cx.argument::<JsArrayBuffer>(0)?.root(&mut cx).into_inner(&mut cx);
  let callback = cx.argument::<JsFunction>(1)?.root(&mut cx);
  let channel = cx.channel();

  let buffer = mempool_arg.as_slice(&mut cx);
  let thread_transactions = ThreadTransaction::batch_from_buffer(buffer);

  let mut map = THREAD_TRANSACTIONS.lock().unwrap();
  map.clear();
  for tx in thread_transactions {
    map.insert(tx.uid, tx);
  }
  drop(map);

  run_in_thread(channel, callback);

  Ok(cx.undefined())
}

fn update(mut cx: FunctionContext) -> JsResult<JsUndefined> {
  let new_txs_arg = cx.argument::<JsArrayBuffer>(0)?.root(&mut cx).into_inner(&mut cx);
  let remove_txs_arg = cx.argument::<JsArrayBuffer>(1)?.root(&mut cx).into_inner(&mut cx);
  let callback = cx.argument::<JsFunction>(2)?.root(&mut cx);
  let channel = cx.channel();

  let mut map = THREAD_TRANSACTIONS.lock().unwrap();
  let new_tx_buffer = new_txs_arg.as_slice(&mut cx);
  let thread_transactions = ThreadTransaction::batch_from_buffer(new_tx_buffer);
  for tx in thread_transactions {
    map.insert(tx.uid, tx);
  }

  let remove_tx_buffer = remove_txs_arg.as_slice(&mut cx);
  let remove_ids = utils::txids_from_buffer(remove_tx_buffer);
  for txid in &remove_ids {
    map.remove(txid);
  }
  drop(map);

  run_in_thread(channel, callback);

  Ok(cx.undefined())
}

fn run_in_thread(channel: Channel, callback: Root<JsFunction>) {
  std::thread::spawn(move || {
    let mut map = THREAD_TRANSACTIONS.lock().unwrap();
    let (blocks, rates, clusters) = gbt::gbt(map.deref_mut());
    drop(map);

    channel.send(move |mut cx| {
      let result = JsObject::new(&mut cx);

      let js_blocks = JsArray::new(&mut cx, blocks.len() as u32);
      for (i, block) in blocks.iter().enumerate() {
        let inner = JsArray::new(&mut cx, block.len() as u32);
        for (j, uid) in block.iter().enumerate() {
          let v = cx.number(*uid);
          inner.set(&mut cx, j as u32, v)?;
        }
        js_blocks.set(&mut cx, i as u32, inner)?;
      }

      let js_clusters = JsArray::new(&mut cx, clusters.len() as u32);
      for (i, cluster) in clusters.iter().enumerate() {
        let inner = JsArray::new(&mut cx, cluster.len() as u32);
        for (j, uid) in cluster.iter().enumerate() {
          let v = cx.number(*uid);
          inner.set(&mut cx, j as u32, v)?;
        }
        js_clusters.set(&mut cx, i as u32, inner)?;
      }

      let js_rates = JsArray::new(&mut cx, rates.len() as u32);
      for (i, (uid, rate)) in rates.iter().enumerate() {
        let inner = JsArray::new(&mut cx, 2);
        let js_uid = cx.number(*uid);
        let js_rate = cx.number(*rate);
        inner.set(&mut cx, 0, js_uid)?;
        inner.set(&mut cx, 1, js_rate)?;
        js_rates.set(&mut cx, i as u32, inner)?;
      }

      result.set(&mut cx, "blocks", js_blocks)?;
      result.set(&mut cx, "clusters", js_clusters)?;
      result.set(&mut cx, "rates", js_rates)?;

      let callback = callback.into_inner(&mut cx);
      let this = cx.undefined();
      let args = vec![
        result.upcast()
      ];

      callback.call(&mut cx, this, args)?;

      Ok(())
    });
  });
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
  cx.export_function("make", make)?;
  cx.export_function("update", update)?;
  Ok(())
}
