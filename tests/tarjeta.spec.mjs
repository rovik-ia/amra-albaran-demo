// La tarjeta de visita: se lee el QR de verdad y se comprueba el PDF de imprenta.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { vigilar } from "./comun.mjs";

async function abrir(page) {
  await page.goto("./tarjeta.html");
  await expect(page.locator("h1")).toHaveText("Tu tarjeta de visita");
}
async function rellenar(page) {
  await page.fill("#nombre", "Marc Vidal Roca");
  await page.fill("#movil", "612 345 678");
  await page.fill("#email", "marc.vidal@example.com");
}
async function leerQR(page) {
  // el mismo trazado del QR, en grande y sobre blanco, como lo vería la cámara del móvil
  const svg = await page.locator("#dorso .qr svg").evaluate((el) => el.outerHTML);
  const lienzo = await page.context().newPage();
  await lienzo.setContent(`<body style="margin:0;background:#fff"><div id="q" style="width:420px;height:420px;padding:40px;background:#fff">${svg}</div></body>`);
  const png = PNG.sync.read(await lienzo.locator("#q").screenshot());
  await lienzo.close();
  const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return r && r.data;
}

test("carga sin errores ni peticiones a terceros y no desborda", async ({ page }) => {
  const problemas = vigilar(page);
  await abrir(page);
  await rellenar(page);
  await page.waitForLoadState("networkidle");
  expect(problemas).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("pide nombre y móvil antes de imprimir", async ({ page }) => {
  await abrir(page);
  await expect(page.locator("#aviso")).toContainText("tu nombre");
  await expect(page.locator("#imprA4")).toBeDisabled();
  await rellenar(page);
  await expect(page.locator("#imprA4")).toBeEnabled();
  await expect(page.locator("#frente")).toContainText("Marc Vidal Roca");
  await expect(page.locator("#frente")).toContainText("+34 612 345 678");
});

test("el QR abre tu WhatsApp", async ({ page }, info) => {
  test.skip(!["movil-390", "escritorio-1440"].includes(info.project.name), "basta con dos tamaños");
  await abrir(page);
  await rellenar(page);
  expect(await leerQR(page)).toBe("https://wa.me/34612345678?text=Hola%20Marc%2C%20");
});

test("el QR guarda tu contacto, con tildes", async ({ page }, info) => {
  test.skip(!["movil-390", "escritorio-1440"].includes(info.project.name), "basta con dos tamaños");
  await abrir(page);
  await rellenar(page);
  await page.locator("label", { hasText: "Guarda tu contacto" }).click();
  const vcard = await leerQR(page);
  expect(vcard).toContain("FN:Marc Vidal Roca");
  expect(vcard).toContain("N:Vidal Roca;Marc;;;");
  expect(vcard).toContain("TITLE:Coordinación de obras");
  expect(vcard).toContain("TEL;TYPE=CELL:+34612345678");
  expect(vcard).toContain("ORG:Amra Building");
});

test("los datos se recuerdan al volver", async ({ page }) => {
  await abrir(page);
  await rellenar(page);
  await page.reload();
  await expect(page.locator("#nombre")).toHaveValue("Marc Vidal Roca");
});

test("hoja A4: 10 tarjetas por cara con marcas de corte", async ({ page }, info) => {
  test.skip(info.project.name !== "escritorio-1440", "la impresión se prueba una vez");
  await abrir(page);
  await rellenar(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.click("#imprA4");
  await expect(page.locator("#imprimir .hoja.a4")).toHaveCount(2);
  await expect(page.locator("#imprimir .hoja.a4").first().locator(".tj")).toHaveCount(10);
  await expect(page.locator("#imprimir .hoja.a4").nth(1).locator(".tj.dorso")).toHaveCount(10);
  expect(await page.locator("#imprimir .hoja.a4").first().locator(".corte").count()).toBeGreaterThanOrEqual(18);
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(2);
  const [, w, h] = pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  expect(Math.round(Number(w) / 72 * 25.4)).toBe(210);
  expect(Math.round(Number(h) / 72 * 25.4)).toBe(297);
});

test("PDF de imprenta: 2 páginas de 91 × 61 mm (85 × 55 con sangrado)", async ({ page }, info) => {
  test.skip(info.project.name !== "escritorio-1440", "la impresión se prueba una vez");
  await abrir(page);
  await rellenar(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.click("#imprImp");
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(2);
  const [, w, h] = pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  expect(Math.round(Number(w) / 72 * 25.4)).toBe(91);
  expect(Math.round(Number(h) / 72 * 25.4)).toBe(61);
});

test("accesibilidad sin fallos graves (axe, WCAG 2.1 AA)", async ({ page }, info) => {
  test.skip(!["movil-390", "escritorio-1440"].includes(info.project.name), "basta con móvil y escritorio");
  await abrir(page);
  await rellenar(page);
  await page.locator("summary", { hasText: "Datos de la empresa" }).click();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id} ${v.nodes[0].target}`)).toEqual([]);
});
