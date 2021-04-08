import mempoolJS from '../../src/index';

const init = async () => {
  const { fees } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);
};
init();
