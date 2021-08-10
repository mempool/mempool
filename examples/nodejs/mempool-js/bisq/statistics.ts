import mempoolJS from "./../../../../src/index";

const init = async () => {
  try {
    const {
      bisq: { statistics },
    } = mempoolJS();
    
    const stats = await statistics.getStats();
    console.log(stats);
  } catch (error) {
    console.log(error);
  }
};
init();
