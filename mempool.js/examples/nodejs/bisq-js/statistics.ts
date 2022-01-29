import bisqJS from "./../../../src/index-bisq";

const init = async () => {
  try {
    const { statistics } = bisqJS();
    
    const stats = await statistics.getStats();
    console.log(stats);
  } catch (error) {
    console.log(error);
  }
};
init();
