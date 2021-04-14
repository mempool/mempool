import mempoolJS from '../../../src/index';

const init = async () => {
  const {
    bisq: { statistics },
  } = mempoolJS();

  const stats = await statistics.getStats();
  console.log(stats);
};
init();
