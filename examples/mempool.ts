import { mempool } from '../src/index';

const init = async () => {
  const getMempool = await mempool.getMempool();
  console.log(getMempool);

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);
};
init();
