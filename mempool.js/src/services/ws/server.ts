import WebSocket from 'ws';

const serverWS = (
  options: string[],
  endpoint: string,
): WebSocket => {
  const ws = new WebSocket(endpoint);
  const interval = setInterval(function ping() {
    ws.ping();
  }, 30000);

  ws.on("open", function open() {
    ws.send(JSON.stringify({ action: "want", data: options }));
  });

  ws.on("close", async function close() {
    clearInterval(interval);
    ws.terminate();
    await sleep(60000);
    serverWS(options, endpoint);
  });
  return ws;
}

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export default serverWS;
