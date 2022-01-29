const serverWS = (
  options: string[],
  endpoint: string,
): WebSocket => {
  const ws = new WebSocket(endpoint);

  ws.addEventListener("open", function open() {
    ws.send(JSON.stringify({ action: "want", data: options }));
  });

  ws.addEventListener("close", async function close() {
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

