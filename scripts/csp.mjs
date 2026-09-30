// Recalcula la huella SHA-256 del script en línea de cada página y la escribe en su Content-Security-Policy.
// Ejecutar tras cualquier cambio en un script: npm run csp
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

for (const pagina of ["index.html", "tarjeta.html"]) {
  const ruta = new URL(`../${pagina}`, import.meta.url);
  const html = readFileSync(ruta, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) throw new Error(`${pagina}: se esperaba un único script en línea y hay ${scripts.length}`);
  if (!/script-src[^;]*'sha256-[^']*'/.test(html)) throw new Error(`${pagina}: no se encontró la huella en script-src`);
  const hash = createHash("sha256").update(scripts[0][1], "utf8").digest("base64");
  writeFileSync(ruta, html.replace(/(script-src[^;]*)'sha256-[^']*'/, `$1'sha256-${hash}'`));
  console.log(`${pagina}: sha256-${hash}`);
}
