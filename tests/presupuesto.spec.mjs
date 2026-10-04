// Presupuesto (solo en tus datos): preguntas de la reunión, coste de la hora y precio por m², y ofertas por partidas.
// Las cifras esperadas están calculadas a mano, no con la fórmula de la app:
//   salario/h oficial = 32.178,55 / 1.736 = 18,536 → con SS 32 % y 1,50 €/h de otros = 25,9676 €/h
//   precio = coste × (1 + 13 % + 6 %) = 30,9014 €/h · peón: 22,2974 → 26,5339 €/h
//   cuadrilla 2 oficiales + 1 peón × 8 h = 593,86 €/día · 40 m²/día + 3 €/m² de material = 17,8465 €/m² → 21,2373 €/m²
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { HOY, KEY_REAL, vigilar, irA, sinDesbordes, sembrarReales } from "./comun.mjs";
import { readFileSync } from "node:fs";

const FIX = (f) => new URL(`./fixtures/${f}`, import.meta.url).pathname;

const CAPTURAS = process.env.CAPTURAS || "";

async function abrir(page, ruta = "./") {
  await page.clock.setFixedTime(HOY);
  page.on("dialog", (d) => d.accept());
  await page.goto(ruta);
  await expect(page.locator(".topbar")).toBeVisible();
}
async function abrirPresupuesto(page) {
  await abrir(page);
  await irA(page, "Presupuesto");
  await expect(page.getByRole("heading", { name: "Presupuesto", level: 2 })).toBeVisible();
}
async function abreTodo(page) {
  await page.evaluate(() => document.querySelectorAll("#s-presupuesto details").forEach((d) => { d.open = true; }));
}
function fila(page, texto) {
  return page.locator("#pqRes div", { has: page.locator("dt", { hasText: texto }) }).locator("dd");
}
async function abreCoste(page) {
  if (!(await page.locator("#pqCoste").evaluate((d) => d.open))) await page.locator("#pqCoste summary").click();
}
async function rellenaCalculo(page) {
  await abreCoste(page);
  await page.fill("#pcSS", "32");
  await page.fill("#pcOtros", "1,5");
  await page.fill("#pcGG", "13");
  await page.fill("#pcBI", "6");
  await page.fill("#pcNOf", "2");
  await page.fill("#pcNPe", "1");
  await page.fill("#pcRend", "40");
  await page.fill("#pcMat", "3");
}
async function anadePartida(page, texto) {
  await page.selectOption("#ofAdd", { label: texto });
}
function partida(page, n) {
  return page.locator("#ofLineas .plin").nth(n);
}

test.describe("presupuesto", () => {
  test("solo aparece en tus datos, no en la demo", async ({ page }) => {
    const problemas = vigilar(page);
    await abrir(page);
    await expect(page.getByRole("tab", { name: "Presupuesto" })).toBeVisible();
    await abrir(page, "./?demo");
    await expect(page.getByRole("tab", { name: "Presupuesto" })).toBeHidden();
    expect(problemas).toEqual([]);
  });

  test("el coste de la hora parte del convenio y avisa de todo lo que falta", async ({ page }) => {
    const problemas = vigilar(page);
    await abrirPresupuesto(page);
    await abreCoste(page);
    await expect(page.locator("#pcSOf")).toHaveValue("32.178,55");
    await expect(page.locator("#pcSPe")).toHaveValue("27.351,74");
    await expect(page.locator("#pcHoras")).toHaveValue("1.736");
    await expect(page.locator("#pcSS")).toHaveValue("");
    // sin Seguridad Social ni márgenes: solo el salario por hora, y se dice que falta
    await expect(fila(page, "Oficial 1.ª · coste por hora")).toHaveText("18,54 €");
    await expect(fila(page, "Precio por m² (sin IVA)")).toHaveText("—");
    const aviso = page.locator("#pqAviso");
    await expect(aviso).toContainText("Seguridad Social");
    await expect(aviso).toContainText("gastos generales");
    await expect(aviso).toContainText("beneficio");
    await expect(aviso).toContainText("m² por día");

    await rellenaCalculo(page);
    await expect(fila(page, "Oficial 1.ª · coste por hora")).toHaveText("25,97 €");
    await expect(fila(page, "Oficial 1.ª · precio por hora")).toHaveText("30,90 €");
    await expect(fila(page, "Peón · coste por hora")).toHaveText("22,30 €");
    await expect(fila(page, "Peón · precio por hora")).toHaveText("26,53 €");
    await expect(fila(page, "Cuadrilla · coste por día")).toHaveText("593,86 €");
    await expect(fila(page, "Coste por m²")).toHaveText("17,85 €");
    await expect(fila(page, "Precio por m² (sin IVA)")).toHaveText("21,24 €");
    await expect(aviso).toContainText("Todos los datos puestos");

    // un número mal escrito se marca y no cuenta
    await page.fill("#pcRend", "cuarenta");
    await expect(page.locator("#pcRend")).toHaveAttribute("aria-invalid", "true");
    await expect(fila(page, "Precio por m² (sin IVA)")).toHaveText("—");
    await page.fill("#pcRend", "40");
    await expect(page.locator("#pcRend")).toHaveAttribute("aria-invalid", "false");
    // al salir del campo se escribe a la española
    await page.fill("#pcOtros", "1.5");
    await page.locator("#pcOtros").blur();
    await expect(page.locator("#pcOtros")).toHaveValue("1,50");
    expect(problemas).toEqual([]);
  });

  test("la oferta suma partidas, usa el precio calculado y se copia", async ({ page, context }, info) => {
    const problemas = vigilar(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await abrirPresupuesto(page);
    await rellenaCalculo(page);

    await page.fill("#ofCli", "Cliente de ejemplo SL");
    await page.fill("#ofObra", "Pavimento de un bloque de viviendas");
    await page.fill("#ofVal", "30");
    await expect(page.locator("#ofSel option:checked")).toHaveText("Cliente de ejemplo SL · Pavimento de un bloque de viviendas · 30/09");

    await anadePartida(page, "Colocación de pavimento cerámico (m²)");
    await expect(partida(page, 0).locator('[data-f="q"]')).toBeFocused();
    await page.keyboard.type("120");
    await partida(page, 0).getByRole("button", { name: "Usar el precio calculado en la partida 1" }).click();
    await expect(partida(page, 0).locator('[data-f="p"]')).toHaveValue("21,24");
    await expect(partida(page, 0).locator(".pl-imp")).toHaveText("2.548,80 €");

    await anadePartida(page, "Mano de obra por horas · oficial 1.ª (h)");
    await partida(page, 1).locator('[data-f="q"]').fill("16");
    await partida(page, 1).getByRole("button", { name: "Usar el precio calculado en la partida 2" }).click();
    await expect(partida(page, 1).locator('[data-f="p"]')).toHaveValue("30,90");
    await expect(page.locator("#ofTotal")).toHaveText("3.043,20 €");
    await expect(page.locator("#ofResumen")).toHaveText("2 partidas · 3.043,20 €");

    // una partida en ud no tiene precio calculado: se avisa y no se inventa
    await anadePartida(page, "Otra partida, en blanco");
    await expect(partida(page, 2).locator('[data-f="c"]')).toBeFocused();
    await page.keyboard.type("Desplazamiento");
    await partida(page, 2).locator('[data-f="u"]').selectOption("ud");
    await partida(page, 2).getByRole("button", { name: "Usar el precio calculado en la partida 3" }).click();
    await expect(page.locator("#ofHint")).toContainText("Escribe el precio a mano");
    await expect(partida(page, 2).locator('[data-f="p"]')).toHaveValue("");
    await partida(page, 2).getByRole("button", { name: "Quitar la partida 3" }).click();
    await expect(page.locator("#ofLineas .plin")).toHaveCount(2);

    await page.getByRole("button", { name: "Insertar condiciones tipo" }).click();
    await expect(page.locator("#ofCond")).toHaveValue(/Medición: contradictoria/);

    if (CAPTURAS && ["movil-390", "escritorio-1440"].includes(info.project.name)) {
      await abreTodo(page);
      await page.screenshot({ path: `${CAPTURAS}/presupuesto-${info.project.name}.png`, fullPage: true });
    }

    await page.getByRole("button", { name: "Copiar la oferta" }).click();
    await expect(page.locator("#ofHint")).toContainText("La oferta copiada");
    const texto = await page.evaluate(() => navigator.clipboard.readText());
    expect(texto).toContain("Oferta · Cliente de ejemplo SL · Pavimento de un bloque de viviendas");
    expect(texto).toContain("Fecha: 30/09/2026 · Válida 30 días");
    expect(texto).toContain("· Colocación de pavimento cerámico: 120 m² × 21,24 € = 2.548,80 €");
    expect(texto).toContain("· Mano de obra por horas · oficial 1.ª: 16 h × 30,90 € = 494,40 €");
    expect(texto).toContain("Total sin IVA: 3.043,20 €");
    expect(texto).toContain("Condiciones:");
    expect(problemas).toEqual([]);
  });

  test("las preguntas guardan lo que te dice, cuentan y se copian", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await abrirPresupuesto(page);
    await expect(page.locator("#pqCuenta")).toHaveText("0 de 14");
    await page.getByLabel("Tarifa que cobra hoy por hora (oficial y peón)").fill("Oficial 28 €/h, peón 22 €/h");
    await page.getByLabel("Cuánto tardan en pagarle").fill("90 días\nalgunos 120");
    await expect(page.locator("#pqCuenta")).toHaveText("2 de 14");
    await page.getByLabel("Lista de obras activas con código y dirección").check();
    await page.getByRole("button", { name: "Copiar mis notas" }).click();
    const texto = await page.evaluate(() => navigator.clipboard.readText());
    expect(texto).toContain("Notas de la reunión · 30/09/2026");
    expect(texto).toContain("· Tarifa que cobra hoy por hora (oficial y peón): Oficial 28 €/h, peón 22 €/h");
    expect(texto).toContain("· Cuánto tardan en pagarle: 90 días / algunos 120");
    expect(texto).toContain("[x] Lista de obras activas con código y dirección");
    expect(texto).toContain("[ ] Fecha de la siguiente reunión");
  });

  test("todo sobrevive a recargar y a varias ofertas", async ({ page }) => {
    await abrirPresupuesto(page);
    await page.getByLabel("Cuánto tardan en pagarle").fill("60 días");
    await abreCoste(page);
    await page.fill("#pcSS", "31,5");
    await page.fill("#ofCli", "Primera");
    await anadePartida(page, "Rodapié cerámico (ml)");
    await partida(page, 0).locator('[data-f="q"]').fill("85");
    await partida(page, 0).locator('[data-f="p"]').fill("4,2");
    await page.getByRole("button", { name: "Nueva oferta" }).click();
    await expect(page.locator("#ofCli")).toBeFocused();
    await page.keyboard.type("Segunda");
    await expect(page.locator("#ofSel option")).toHaveCount(2);
    await expect(page.locator("#ofLineas .plin")).toHaveCount(0);

    await page.reload();
    await irA(page, "Presupuesto");
    await expect(page.getByLabel("Cuánto tardan en pagarle")).toHaveValue("60 días");
    await abreCoste(page);
    await expect(page.locator("#pcSS")).toHaveValue("31,50");
    await expect(page.locator("#ofCli")).toHaveValue("Segunda");
    await page.locator("#ofSel").selectOption({ label: "Primera · 30/09" });
    await expect(page.locator("#ofTotal")).toHaveText("357,00 €");
    await page.getByRole("button", { name: "Borrar esta oferta" }).click();
    await expect(page.locator("#ofSel option")).toHaveCount(1);
    await expect(page.locator("#ofCli")).toHaveValue("Segunda");
    const guardado = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).pre, KEY_REAL);
    expect(guardado.ofertas.map((o) => o.cliente)).toEqual(["Segunda"]);
    expect(guardado.calc.ss).toBe(31.5);
  });

  test("datos rotos o de otra versión no la rompen", async ({ page }) => {
    const problemas = vigilar(page);
    await sembrarReales(page, {
      v: 2, obras: [], plantilla: [], albaranes: [],
      pre: { calc: { sOf: "mucho", horas: -3, ss: 30 }, notas: { pago: 42, rea: "Sí, desde 2024" }, hechos: { c1: "sí" },
             ofertas: [{ id: "o1", cliente: { x: 1 }, partidas: "nada" }, { sin: "id" }, { id: "o2", fecha: "ayer", partidas: [{ id: "l1", u: "furgoneta", q: "3", p: 2, cod: 7, ref: -4 }] }],
             actual: "no-existe" },
    });
    await abrirPresupuesto(page);
    await abreCoste(page);
    await expect(page.locator("#pcSOf")).toHaveValue("32.178,55");
    await expect(page.locator("#pcHoras")).toHaveValue("1.736");
    await expect(page.locator("#pcSS")).toHaveValue("30");
    await expect(page.getByLabel("¿Está inscrito en el REA? ¿Desde cuándo?")).toHaveValue("Sí, desde 2024");
    await expect(page.locator("#ofSel option")).toHaveCount(2);
    await page.locator("#ofSel").selectOption({ index: 1 });
    await expect(partida(page, 0).locator('[data-f="u"]')).toHaveValue("m²");
    await expect(partida(page, 0).locator('[data-f="q"]')).toHaveValue("");
    expect(problemas).toEqual([]);
  });

  test("con teclado: se llega con las flechas y se rellena", async ({ page }) => {
    await abrir(page);
    await irA(page, "Nuevo albarán");
    await page.getByRole("tab", { name: "Nuevo albarán" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Presupuesto" })).toBeFocused();
    await expect(page.getByRole("tab", { name: "Presupuesto" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Tab");
    await expect(page.locator("#pqPreg summary")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Tarifa que cobra hoy por hora (oficial y peón)")).toBeFocused();
    await page.keyboard.type("28 €/h");
    await expect(page.locator("#pqCuenta")).toHaveText("1 de 14");
  });

  test("calidad: sin desbordes, controles de 44 px y accesibilidad", async ({ page }, info) => {
    const problemas = vigilar(page);
    await abrirPresupuesto(page);
    await anadePartida(page, "Colocación de alicatado en paredes (m²)");
    await abreTodo(page);
    await sinDesbordes(page, "Presupuesto");
    if (info.project.name.startsWith("movil")) {
      const pequenos = await page.evaluate(() =>
        [...document.querySelectorAll("#s-presupuesto button, #s-presupuesto select, #s-presupuesto input:not([type=checkbox]), #s-presupuesto textarea, #s-presupuesto .chk, #s-presupuesto summary")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 44 || r.width < 44)
          .map(({ el, r }) => `${el.getAttribute("aria-label") || el.id || el.textContent.trim()}: ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
      expect(pequenos).toEqual([]);
    }
    if (["movil-390", "escritorio-1440"].includes(info.project.name)) {
      const r = await new AxeBuilder({ page }).include("#s-presupuesto").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}`)).toEqual([]);
    }
    expect(problemas).toEqual([]);
  });
});

test.describe("traer mediciones de la constructora", () => {
  function linea(page, n) { return page.locator("#ofLineas .plin").nth(n); }

  test("lee un BC3 de Presto y añade solo las partidas de cerámica", async ({ page }) => {
    const problemas = vigilar(page);
    await abrirPresupuesto(page);
    await page.setInputFiles("#bc3In", FIX("mediciones-ansi.bc3"));
    await expect(page.locator("#bc3Info")).toHaveText(
      "«Bloque de viviendas de ejemplo» · 3 capítulos · 5 partidas. Marcadas 4 que parecen de cerámica: revísalas antes de añadir.");
    // capítulos anidados con su etiqueta; el descompuesto de la fábrica (mano de obra, ladrillo, %) no sale como partida
    await expect(page.locator("#bc3Lista summary")).toHaveText(["1 ALBAÑILERÍA1", "2 REVESTIMIENTOS Y SOLADOS › 2.1 Solados2", "2 REVESTIMIENTOS Y SOLADOS › 2.2 Alicatados2"]);
    await expect(page.locator("#bc3Lista")).not.toContainText("Oficial primera");
    await expect(page.getByLabel(/Fábrica de ladrillo cerámico/)).not.toBeChecked();
    await expect(page.locator("#bc3Add")).toHaveText("Añadir 4 partidas a la oferta");
    if (CAPTURAS && ["movil-390", "escritorio-1440"].includes(test.info().project.name)) {
      await page.locator("#bc3Res").screenshot({ path: `${CAPTURAS}/importar-bc3-${test.info().project.name}.png` });
    }
    await page.locator("#bc3Add").click();
    await expect(page.locator("#impHint")).toContainText("Añadidas 4 partidas del BC3");
    await expect(page.locator("#ofLineas .plin")).toHaveCount(4);
    await expect(linea(page, 0).locator(".pl-cod")).toHaveText("2.1.1");
    await expect(linea(page, 0).locator('[data-f="c"]')).toHaveValue("Solado de gres porcelánico 60x60 cm");
    await expect(linea(page, 0).locator('[data-f="q"]')).toHaveValue("415,20");
    await expect(linea(page, 0).locator('[data-f="u"]')).toHaveValue("m²");
    await expect(linea(page, 0).locator(".pl-ref")).toHaveText("Precio en el proyecto de la constructora: 32,10 € por m²");
    await expect(linea(page, 1).locator('[data-f="u"]')).toHaveValue("ml");
    await expect(linea(page, 1).locator('[data-f="q"]')).toHaveValue("390");
    await expect(linea(page, 2).locator('[data-f="q"]')).toHaveValue("268,75");
    // factor 2 × rendimiento 12, sin ~M; precio 0 = sin precio del proyecto
    await expect(linea(page, 3).locator('[data-f="q"]')).toHaveValue("24");
    await expect(linea(page, 3).locator('[data-f="u"]')).toHaveValue("ud");
    await expect(linea(page, 3).locator(".pl-ref")).toHaveCount(0);
    await expect(page.locator("#bc3Add")).toBeDisabled();
    // el precio sigue siendo el de Amra: vacío hasta que se pone
    await expect(page.locator("#ofTotal")).toHaveText("0,00 €");

    await page.fill("#bc3Buscar", "ladrillo");
    await expect(page.locator("#bc3Lista .chk:visible")).toHaveCount(1);
    await page.getByLabel(/Fábrica de ladrillo cerámico/).check();
    await page.locator("#bc3Add").click();
    await expect(page.locator("#ofLineas .plin")).toHaveCount(5);

    await page.reload();
    await irA(page, "Presupuesto");
    await expect(linea(page, 0).locator(".pl-cod")).toHaveText("2.1.1");
    await expect(linea(page, 0).locator(".pl-ref")).toContainText("32,10 €");
    expect(problemas).toEqual([]);
  });

  test("entiende BC3 de DOS (850) y UTF-8 aunque diga ANSI, y rechaza lo que no es BC3", async ({ page }) => {
    await abrirPresupuesto(page);
    await page.setInputFiles("#bc3In", FIX("mediciones-850.bc3"));
    await expect(page.locator("#bc3Lista")).toContainText("Peldaño de baldosa cerámica con zanquín");
    await expect(page.locator("#bc3Info")).toContainText("1 capítulo · 2 partidas. Marcadas 2");
    await page.setInputFiles("#bc3In", FIX("mediciones-utf8.bc3"));
    await expect(page.locator("#bc3Lista")).toContainText("Rodapié cerámico de 7 cm");
    await expect(page.locator("#bc3Lista")).toContainText("80 m²");
    await page.setInputFiles("#bc3In", FIX("no-es-bc3.bc3"));
    await expect(page.locator("#impHint")).toContainText("no es un BC3");
    await expect(page.locator("#bc3Res")).toBeHidden();
  });

  test("pega filas de Presto o de Excel y guarda el precio del proyecto si cuadra", async ({ page }) => {
    await abrirPresupuesto(page);
    await page.fill("#pegaTxt", [
      "Código\tNat\tUd\tResumen\tCanPres\tPrPres\tImpPres",
      "02\tCapítulo\t\tREVESTIMIENTOS Y SOLADOS\t\t\t15.324,77",
      "E11EGP010\tPartida\tm2\tSolado de gres porcelánico 60x60 cm\t415,20\t32,10\t13.327,92",
      "E11ERP020\tPartida\tm\tRodapié de gres porcelánico 8 cm\t390,00\t7,80\t3.042,00",
      "E12PE010\tPartida\tud\tPeldaño de gres porcelánico\t24",
    ].join("\n"));
    await page.getByRole("button", { name: "Añadir las filas pegadas" }).click();
    await expect(page.locator("#impHint")).toHaveText(
      "Añadidas 3 partidas pegadas. Ponles precio con «Usar precio calculado» o a mano. 2 filas ignoradas (capítulos o filas sin unidad o cantidad).");
    await expect(linea(page, 0).locator(".pl-cod")).toHaveText("E11EGP010");
    await expect(linea(page, 0).locator(".pl-ref")).toContainText("32,10 €");
    await expect(linea(page, 1).locator('[data-f="u"]')).toHaveValue("ml");
    await expect(linea(page, 2).locator('[data-f="q"]')).toHaveValue("24");
    await expect(linea(page, 2).locator(".pl-ref")).toHaveCount(0);
    await expect(page.locator("#pegaTxt")).toHaveValue("");
  });

  test("la oferta se descarga en Excel con código, cantidades, precios y total", async ({ page }) => {
    await abrirPresupuesto(page);
    await page.fill("#ofCli", "Cliente de ejemplo SL");
    await page.setInputFiles("#bc3In", FIX("mediciones-ansi.bc3"));
    await page.locator("#bc3Add").click();
    await linea(page, 0).locator('[data-f="p"]').fill("30");
    await linea(page, 1).locator('[data-f="p"]').fill("6,5");
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar Excel" }).click()]);
    expect(descarga.suggestedFilename()).toBe("oferta-cliente-de-ejemplo-sl-2026-09-30.csv");
    const csv = readFileSync(await descarga.path(), "utf8");
    const filas = csv.replace(/^﻿/, "").split("\r\n");
    expect(filas[0]).toBe("Oferta;Cliente de ejemplo SL");
    expect(filas[3]).toBe("Código;Concepto;Unidad;Cantidad;Precio (€);Importe (€)");
    expect(filas[4]).toBe("2.1.1;Solado de gres porcelánico 60x60 cm;m²;415,2;30,00;12456,00");
    expect(filas[5]).toBe("2.1.2;Rodapié de gres porcelánico 8 cm;ml;390;6,50;2535,00");
    expect(filas[7]).toBe("E12PE010;Peldaño de gres porcelánico;ud;24;;0,00");
    expect(filas.at(-1)).toBe(";;;;Total sin IVA;14991,00");
    await expect(page.locator("#ofHint")).toContainText("Excel descargado");
  });

  test("calidad de la importación: 44 px, sin desbordes y axe", async ({ page }, info) => {
    const problemas = vigilar(page);
    await abrirPresupuesto(page);
    await page.setInputFiles("#bc3In", FIX("mediciones-ansi.bc3"));
    await page.evaluate(() => document.querySelectorAll("#bc3Lista details").forEach((d) => { d.open = true; }));
    await sinDesbordes(page, "importación BC3");
    if (info.project.name.startsWith("movil")) {
      const pequenos = await page.evaluate(() =>
        [...document.querySelectorAll("#bc3Res button, #bc3Res input:not([type=checkbox]), #bc3Res .chk, #bc3Res summary, #bc3Btn, #pegaBtn")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 44 || r.width < 44)
          .map(({ el, r }) => `${el.id || el.textContent.trim().slice(0, 30)}: ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
      expect(pequenos).toEqual([]);
    }
    if (["movil-390", "escritorio-1440"].includes(info.project.name)) {
      const r = await new AxeBuilder({ page }).include("#s-presupuesto").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}`)).toEqual([]);
    }
    expect(problemas).toEqual([]);
  });
});
