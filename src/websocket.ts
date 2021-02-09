const WebSocket = require('ws');

const ws = new WebSocket('wss://mempool.space/api/v1/ws');

const init = (params: { options: string[] }) => {
  ws.on('open', function open() {
    ws.send(JSON.stringify({ action: 'init' }));
    setInterval(function timeout() {
      ws.send(
        JSON.stringify({
          action: 'want',
          data: params.options,
        })
      );
    }, 500);
  });
  return ws;
};

export default {
  init,
};
