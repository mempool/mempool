import mempoolJS from "@mempool/mempool.js";

const { bitcoin: { websocket } } = mempoolJS();

const init = async () => {
  
  const ws = websocket.initServer({
    options: ["blocks", "stats", "mempool-blocks", "live-2h-chart"],
  });
  
  ws.on("message", function incoming(data) {
    const res = JSON.parse(data.toString());
    if (res.blocks) {
      console.log(res.blocks);
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
}
init();
