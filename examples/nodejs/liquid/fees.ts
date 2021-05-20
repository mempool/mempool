import mempoolJS from "@mempool/mempool.js";

const init = async () => {
  const {
    liquid: { fees },
  } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);
};
init();
