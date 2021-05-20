import mempoolJS from "@mempool/mempool.js";

const init = async () => {
  const {
    bitcoin: { mempool },
  } = mempoolJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);
};
init();
