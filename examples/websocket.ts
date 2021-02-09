import { websocket } from '../src/index';

const init = async () => {
  const ws = await websocket.init({
    options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
  });

  ws.on('message', function incoming(data: any) {
    const res = JSON.parse(data);
    if (res.blocks) {
      res.blocks.forEach((block: any) => {
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
