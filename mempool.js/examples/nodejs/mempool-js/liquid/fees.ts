import mempoolJS from "./../../../../src/index";

const init = async () => {
  try {    
    const {
      liquid: { fees },
    } = mempoolJS();
    
    const feesRecommended = await fees.getFeesRecommended();
    console.log(feesRecommended);
    
    const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
    console.log(feesMempoolBlocks);
  } catch (error) {
    console.log(error);    
  }
};
init();
