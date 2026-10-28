import http from "node:http";
import worker from "../worker/index.js";
const server = http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(
      new Request("http://127.0.0.1:4173" + req.url, { method: req.method }),
      {},
      { waitUntil: (p) => p.catch(() => {}) },
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500);
    res.end(e.message);
  }
});
server.listen(4173, "127.0.0.1", () =>
  console.log("Local: http://127.0.0.1:4173"),
);
