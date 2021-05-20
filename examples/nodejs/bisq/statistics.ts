import mempoolJS from "@mempool/mempool.js";

const init = async () => {
  const {
    bisq: { statistics },
  } = mempoolJS();

  const stats = await statistics.getStats();
  console.log(stats);
};
init();
