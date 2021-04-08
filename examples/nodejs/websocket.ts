/* eslint-disable @typescript-eslint/no-explicit-any */
import mempoolJS from '../../src/index';

const init = async () => {
  const { websocket } = mempoolJS();

  const ws = websocket.initServer({
    options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
  });

  ws.on('message', function incoming(data) {
    const res = JSON.parse(data.toString());
    if (res.blocks) {
      res.blocks.forEach((block: { height: any }) => {
        console.log(block.height);
      });
    }
    if (res.mempoolInfo) {
      console.log(res.mempoolInfo);
    }
    if (res.transactions) {
      console.log(res.transactions);
    }
    if (res.mempoolBlocks) {
      console.log(res.mempoolBlocks);
    }
  });
};
init();
