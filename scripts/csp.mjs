// Recalcula la huella SHA-256 del script de index.html y la escribe en la CSP.
// Ejecutar tras cualquier cambio en el script: npm run csp
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ruta = new URL("../index.html", import.meta.url);
const html = readFileSync(ruta, "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error(`Se esperaba un único script en línea y hay ${scripts.length}`);
const hash = createHash("sha256").update(scripts[0][1], "utf8").digest("base64");
const nuevo = html.replace(/script-src 'sha256-[^']*'/, `script-src 'sha256-${hash}'`);
if (nuevo === html && !html.includes(hash)) throw new Error("No se encontró la directiva script-src en la CSP");
writeFileSync(ruta, nuevo);
console.log(`CSP actualizada: sha256-${hash}`);
