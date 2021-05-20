import mempoolJS from "@mempool/mempool.js";

const init = async () => {
  const {
    bitcoin: { fees },
  } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);

  const txid = 'txid';

  const feesCPFP = await fees.getCPFP({ txid });
  console.log(feesCPFP);
};
init();
