// Servidor estático mínimo que reproduce GitHub Pages: la web cuelga de /amra-albaran-demo/.
// /__marker?m=XYZ inyecta una marca en index.html para probar que las actualizaciones llegan.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE = "/amra-albaran-demo/";
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
let marker = "";

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/__marker") {
    marker = url.searchParams.get("m") || "";
    res.writeHead(204).end();
    return;
  }
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404).end("fuera de la web");
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || rel.startsWith("node_modules") || rel.startsWith("tests")) {
    res.writeHead(404).end();
    return;
  }
  try {
    let body = await readFile(file);
    if (rel === "index.html" && marker) {
      body = Buffer.from(body.toString("utf8").replace("</head>", `<meta name="test-marker" content="${marker}"></head>`));
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404).end("no encontrado");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Demo en http://127.0.0.1:${PORT}${BASE}`));
