// Mediciones: los m² que hace cada obra, semana a semana, y la certificación del mes.
// Reloj fijado el jueves 8 de octubre de 2026. Octubre tiene 5 semanas: 1–4, 5–11, 12–18, 19–25 y 26–31.
// Cifras calculadas a mano (los criterios de huecos de cada trabajo, en las pruebas de «puertas y ventanas»):
//   BLANES 135 + 27,45 = 162,45 m² · PALAMOS 80 m² a 9,50 € = 760,00 € · total del mes 242,45 m²
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { KEY_REAL, vigilar, irA, sinDesbordes, sembrarReales, datosReales } from "./comun.mjs";

const HOY_MED = new Date("2026-10-08T10:00:00+02:00");
const OBRAS_MED = ["BLANES", "PALAMOS", "VILABLAREIX", "GIRONA", "AMETLLA"];
// Las obras llegan por un enlace privado (./#obras=…). Direcciones y coordenadas inventadas para la prueba: las reales no van al repositorio.
const OBRAS_PRUEBA = OBRAS_MED.map((cod, i) => ({ cod, dir: `Calle de prueba ${i + 1} · ${["Blanes", "Palamós", "Vilablareix", "Girona", "L'Ametlla"][i]}`,
  mapa: `https://maps.google.com/?q=41.${i + 1}00000,2.${i + 1}00000` }));
const ENLACE = "./#obras=" + encodeURIComponent(JSON.stringify(OBRAS_PRUEBA));
const CAPTURAS = process.env.CAPTURAS || "";

async function abrir(page, ruta = ENLACE, fecha = HOY_MED) {
  await page.clock.setFixedTime(fecha);
  page.on("dialog", (d) => d.accept());
  await page.goto(ruta);
  await expect(page.locator(".topbar")).toBeVisible();
}
function tarjeta(page, cod) {
  return page.locator(".md-obra", { has: page.locator(".md-h .cod", { hasText: new RegExp(`^${cod}$`) }) });
}
function semana(page, cod, n) {
  return tarjeta(page, cod).locator(".md-sem").nth(n - 1);
}
async function anota(page, { obra, fecha, trabajo, cantidad, zona, precio, nota } = {}) {
  if (await page.locator("#mdForm").isHidden()) await page.click("#mdNueva");
  if (obra) await page.selectOption("#mfObra", obra);
  if (fecha) await page.fill("#mfFecha", fecha);
  if (trabajo !== undefined) await eligeTrabajo(page, trabajo);
  if (cantidad !== undefined) await page.fill("#mfQ", cantidad);
  if (zona) await page.fill("#mfZona", zona);
  if (precio !== undefined) await page.fill("#mfP", precio);
  if (nota) await page.fill("#mfNota", nota);
  await page.click("#mfGuardar");
}
// de la lista si está; si no, «Otro trabajo» y se escribe
async function eligeTrabajo(page, t) {
  const enLista = await page.locator("#mfTipo option").evaluateAll((os, t) => os.some((o) => o.value === t), t);
  if (enLista) await page.selectOption("#mfTipo", t);
  else { await page.selectOption("#mfTipo", "__otro"); await page.fill("#mfTrab", t); }
}
function leeCsv(texto) {
  return texto.replace(/^﻿/, "").split("\r\n").map((l) => l.split(";"));
}

test.describe("tus obras por enlace privado", () => {
  test("el enlace carga las 5 obras con su ubicación, abre en Mediciones y se borra de la dirección", async ({ page }) => {
    const problemas = vigilar(page);
    await abrir(page);
    await expect(page.getByRole("tab", { name: "Mediciones" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#mdOk")).toHaveText("Cargadas 5 obras del enlace: BLANES, PALAMOS, VILABLAREIX, GIRONA, AMETLLA.");
    await expect(page.locator(".md-obra .md-h .cod")).toHaveText(OBRAS_MED);
    await expect(tarjeta(page, "BLANES")).toContainText("Calle de prueba 1 · Blanes");
    expect(page.url()).not.toContain("#obras");
    expect(await page.evaluate(() => OBRAS.map((o) => [o.cod, o.dir, o.mapa]))).toEqual(OBRAS_PRUEBA.map((o) => [o.cod, o.dir, o.mapa]));
    await irA(page, "Obras");
    await expect(page.locator(`a[href="${OBRAS_PRUEBA[0].mapa}"]`)).toHaveCount(1);
    // al volver a abrir la app, y aunque se abra otra vez el enlace, no se duplican
    await page.goto("./");
    expect(await page.evaluate(() => OBRAS.length)).toBe(5);
    await page.goto(ENLACE);
    await page.reload();          // en la prueba, cambiar solo el # no recarga; en el móvil el enlace se abre en una pestaña nueva
    await expect(page.locator("#mdOk")).toHaveText("Las obras del enlace ya estaban en este móvil.");
    expect(await page.evaluate(() => OBRAS.length)).toBe(5);
    expect(problemas).toEqual([]);
  });

  test("se añaden a las obras que ya tenías sin tocarlas", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    expect(await page.evaluate(() => OBRAS.map((o) => o.cod))).toEqual(["2415", "2501", ...OBRAS_MED]);
    expect(await page.evaluate(() => OBRAS[0].cli)).toBe("Promociones Valldaura SL");
  });

  test("sin enlace, una instalación nueva no trae obras; un enlace roto avisa y no rompe nada", async ({ page }) => {
    const problemas = vigilar(page);
    await abrir(page, "./");
    expect(await page.evaluate(() => OBRAS.length)).toBe(0);
    await expect(page.getByRole("tab", { name: "Obras" })).toHaveAttribute("aria-selected", "true");
    await page.goto("./#obras=%7Bnoesjson");
    await page.reload();
    await irA(page, "Mediciones");
    await expect(page.locator("#mdOk")).toHaveText("El enlace de obras no se ha podido leer. Pide que te lo manden otra vez.");
    expect(await page.evaluate(() => OBRAS.length)).toBe(0);
    expect(problemas).toEqual([]);
  });
});

test.describe("panel de obras", () => {
  test("toca la obra, toca el trabajo y solo queda poner los m²", async ({ page }) => {
    const problemas = vigilar(page);
    await abrir(page);
    const tiles = page.locator("#mdTiles .md-tile");
    await expect(tiles).toHaveCount(5);
    await expect(tiles.first()).toContainText("BLANES");
    await expect(tiles.first()).toContainText("Blanes");
    await expect(page.locator("#mdTrabajos")).toBeHidden();
    await tiles.first().click();
    await expect(tiles.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#mdTrabTit")).toHaveText("¿Qué has medido en BLANES?");
    const grupos = await page.locator("#mdTrabLista .md-g").allTextContents();
    expect(grupos).toEqual(["Yeso y pladur", "Cerámica (rajola)", "Hormigón (vertido)", "Albañilería", "Acabados", "Otros"]);
    await page.locator("#mdTrabLista .md-chip", { hasText: "Alicatado de rajola" }).click();
    await expect(page.locator("#mdForm")).toBeVisible();
    await expect(page.locator("#mfObra")).toHaveValue("BLANES");
    await expect(page.locator("#mfTipo")).toHaveValue("Alicatado de rajola");
    await expect(page.locator("#mfQ")).toBeFocused();
    await expect(page.locator("#mfCrit")).toContainText("RAG011");
    await page.keyboard.type("40");
    await page.click("#mfGuardar");
    await expect(page.locator("#mdOk")).toHaveText("Guardado: 40 m² de Alicatado de rajola en BLANES · semana 2 (5–11 oct).");
    await expect(tiles.first().locator(".s b")).toHaveText("40 m²");
    // la próxima vez sale arriba lo último que se hizo en esa obra
    await expect(page.locator("#mdTrabLista .md-chip.ult")).toContainText("Alicatado de rajola");
    // el vertido va en m³ y «Otro trabajo» deja escribirlo
    await page.locator("#mdTrabLista .md-chip", { hasText: "Vertido de hormigón en pilares" }).click();
    await expect(page.locator("#mfQu")).toHaveText("m³");
    await page.click("#mfCancelar");
    await page.locator("#mdTrabLista .md-chip", { hasText: "Otro trabajo" }).click();
    await expect(page.locator("#mfTipo")).toHaveValue("__otro");
    await expect(page.locator("#mfTrab")).toBeFocused();
    await page.click("#mfCancelar");
    await tiles.first().click();
    await expect(page.locator("#mdTrabajos")).toBeHidden();
    expect(problemas).toEqual([]);
  });
});

test.describe("anotar", () => {
  test("135 m² de yeso en Blanes esta semana, y sigue ahí al volver", async ({ page }) => {
    const problemas = vigilar(page);
    await abrir(page);
    await expect(page.locator("#mdMes")).toHaveText("Octubre 2026");
    await expect(page.locator("#mdRango")).toHaveText("5 semanas · del 01/10 al 31/10");
    await tarjeta(page, "BLANES").getByRole("button", { name: "Anotar en BLANES" }).click();
    await expect(page.locator("#mfObra")).toHaveValue("BLANES");
    await expect(page.locator("#mfFecha")).toHaveValue("2026-10-08");
    await expect(page.locator("#mfSem")).toHaveText("Semana 2 de octubre · 5–11 oct");
    await anota(page, { trabajo: "Guarnecido y enlucido de yeso", cantidad: "135", zona: "Planta 2" });
    await expect(page.locator("#mdOk")).toHaveText("Guardado: 135 m² de Guarnecido y enlucido de yeso en BLANES · semana 2 (5–11 oct).");
    await expect(page.locator("#mdForm")).toBeHidden();
    await expect(page.locator("#mkM2")).toHaveText("135");
    await expect(page.locator("#mkObras")).toHaveText("1");
    await expect(page.locator("#mkN")).toHaveText("1");
    await expect(tarjeta(page, "BLANES").locator(".md-tot b")).toHaveText("135 m²");
    await expect(semana(page, "BLANES", 2).locator(".md-sh .v")).toHaveText("135 m²");
    await expect(semana(page, "BLANES", 2)).toHaveClass(/hoy/);
    await expect(semana(page, "BLANES", 1).locator(".md-sh .v")).toHaveText("—");
    await expect(semana(page, "BLANES", 3)).toHaveClass(/futura/);
    await expect(semana(page, "BLANES", 2).locator(".md-l")).toContainText("Planta 2");
    await page.reload();
    await expect(tarjeta(page, "BLANES").locator(".md-tot b")).toHaveText("135 m²");
    const guardado = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).meds, KEY_REAL);
    expect(guardado).toHaveLength(1);
    expect(guardado[0]).toMatchObject({ fecha: "2026-10-08", obra: "BLANES", trab: "Guarnecido y enlucido de yeso", u: "m²", q: 135, zona: "Planta 2", p: null });
    expect(problemas).toEqual([]);
  });

  test("medir por paños", async ({ page }) => {
    await abrir(page);
    await page.click("#mdNueva");
    await eligeTrabajo(page, "Guarnecido y enlucido de yeso");
    await page.locator("#mfPanos summary").click();
    await page.click("#mfPanoAdd");
    await page.fill("#mpl0", "4,20"); await page.fill("#mpa0", "2,60"); await page.fill("#mpn0", "2");
    await expect(page.locator("#mpv0")).toHaveText("21,84 m²");
    await page.click("#mfPanoAdd");
    await page.fill("#mpl1", "3"); await page.fill("#mpa1", "2,5");
    await expect(page.locator("#mfPtot")).toHaveText("29,34 m²");
    await expect(page.locator("#mfQ")).toHaveValue("29,34");
    await expect(page.locator("#mfQ")).toHaveJSProperty("readOnly", true);
    // un paño a medias no se guarda
    await page.click("#mfPanoAdd");
    await page.click("#mfGuardar");
    await expect(page.locator("#mfHint")).toHaveText("A un paño o a un hueco le falta una medida. Rellénala o quítalo.");
    await page.getByRole("button", { name: "Quitar Paño 3" }).click();
    await page.click("#mfGuardar");
    await expect(page.locator("#mdOk")).toContainText("Guardado: 29,34 m²");
    const m = await page.evaluate(() => state.meds[0]);
    expect(m.q).toBe(29.34);
    expect(m.panos).toEqual([{ l: 4.2, a: 2.6, e: null, n: 2, h: false }, { l: 3, a: 2.5, e: null, n: 1, h: false }]);
    // al corregirla vuelven los paños
    await semana(page, "BLANES", 2).locator(".md-l").click();
    await expect(page.locator("#mfPanos")).toHaveJSProperty("open", true);
    await expect(page.locator("#mfPanosLista .md-pano")).toHaveCount(2);
    await expect(page.locator("#mfQ")).toHaveValue("29,34");
  });

  // Las mismas aberturas en 150 m²: 3 ventanas de 1,20 × 1,10 (1,32 m² cada una) y 1 puerta de 2,50 × 2,10 (5,25 m²).
  async function conAberturas(page, trabajo, fondo) {
    await page.click("#mdNueva");
    await page.selectOption("#mfObra", "BLANES");
    await eligeTrabajo(page, trabajo);
    await page.fill("#mfQ", "150");
    await page.click("#mfVentana");
    await page.fill("#mpn0", "3"); await page.fill("#mpl0", "1,2"); await page.fill("#mpa0", "1,1");
    if (fondo) await page.fill("#mpf0", fondo);
    await page.click("#mfPuerta");
    await page.fill("#mpn1", "1"); await page.fill("#mpl1", "2,5"); await page.fill("#mpa1", "2,1");
  }
  for (const [trabajo, neto, ventanas, puerta, fuente, fondo] of [
    // yeso (CYPE RPG010): hasta 4 m² no se resta; de la puerta solo lo que pasa de 4 m²: 1,25 → 148,75
    ["Guarnecido y enlucido de yeso", "148,75", "No se resta (1,32 m² c/u)", "− 1,25 m²", "RPG010"],
    // alicatado (RAG011): se restan enteros los de más de 3 m² → 150 − 5,25 = 144,75
    ["Alicatado de rajola", "144,75", "No se resta (1,32 m² c/u)", "− 5,25 m²", "RAG011"],
    // bloque de hormigón (FFQ020): también más de 3 m²
    ["Bloque de hormigón", "144,75", "No se resta (1,32 m² c/u)", "− 5,25 m²", "FFQ020"],
    // pladur (FBY010): aquí se restan enteros → 150 − 3,96 − 5,25 = 140,79
    ["Tabique de pladur", "140,79", "− 3,96 m²", "− 5,25 m²", "FBY010"],
    // SATE (FSM010): más de 1 m² se restan y se suman jambas y dintel: (2 × 1,10 + 1,20) × 0,20 × 3 = 2,04
    //   150 − 3,96 − 5,25 + 2,04 = 142,83
    ["SATE", "142,83", "− 3,96 m² · + 2,04 jambas", "− 5,25 m²", "FSM010", "0,2"],
  ]) {
    test(`puertas y ventanas en ${trabajo}: se restan según su criterio`, async ({ page }) => {
      await abrir(page);
      await conAberturas(page, trabajo, fondo);
      await expect(page.locator("#mfCrit")).toContainText(`Criterio CYPE ${fuente}`);
      await expect(page.locator("#mpv0")).toHaveText(ventanas);
      await expect(page.locator("#mpv1")).toHaveText(puerta);
      await expect(page.locator("#mfNetoV")).toHaveText(`${neto} m²`);
      await expect(page.locator("#mfQlbl")).toHaveText("antes de huecos, en m²");
      await page.click("#mfGuardar");
      await expect(tarjeta(page, "BLANES").locator(".md-tot b")).toHaveText(`${neto} m²`);
    });
  }

  test("recuerda la medida de las puertas y ventanas de cada obra, y lo explica en el Excel", async ({ page }) => {
    await abrir(page);
    await conAberturas(page, "Guarnecido y enlucido de yeso");
    await page.click("#mfGuardar");
    await page.click("#mdNueva");
    await expect(page.locator("#mfObra")).toHaveValue("BLANES");
    await page.click("#mfVentana");
    await expect(page.locator("#mpl0")).toHaveValue("1,2");
    await expect(page.locator("#mpa0")).toHaveValue("1,1");
    await expect(page.locator("#mpn0")).toBeFocused();
    await page.click("#mfCancelar");
    // al corregir, la cantidad escrita es la de antes de restar huecos
    await semana(page, "BLANES", 2).locator(".md-l").click();
    await expect(page.locator("#mfQ")).toHaveValue("150");
    await expect(page.locator("#mfNetoV")).toHaveText("148,75 m²");
    await page.click("#mfCancelar");
    const [d] = await Promise.all([page.waitForEvent("download"), page.click("#mdCsv")]);
    const fila = leeCsv(readFileSync(await d.path(), "utf8"))[3];
    expect([fila[10], fila[11]]).toEqual(["150 m² − 3 ventanas 1,2 × 1,1 (no se resta: hasta 4 m²) − 1 puerta 2,5 × 2,1 (resta lo que pasa de 4 m²: 1,25)", "148,75"]);
  });
  test("cada medición cae en su semana y en su mes", async ({ page }) => {
    await abrir(page);
    await anota(page, { obra: "GIRONA", fecha: "2026-10-01", trabajo: "Alicatado de rajola", cantidad: "40" });
    await expect(page.locator("#mdOk")).toContainText("semana 1 (1–4 oct)");
    await anota(page, { obra: "GIRONA", fecha: "2026-10-04", trabajo: "Alicatado de rajola", cantidad: "10,5" });
    await anota(page, { obra: "GIRONA", fecha: "2026-10-05", trabajo: "Alicatado de rajola", cantidad: "20" });
    await anota(page, { obra: "GIRONA", fecha: "2026-09-30", trabajo: "Alicatado de rajola", cantidad: "33" });
    // la del 30 de septiembre se va a septiembre, y la pantalla salta a ese mes
    await expect(page.locator("#mdMes")).toHaveText("Septiembre 2026");
    await expect(semana(page, "GIRONA", 5).locator(".md-sh")).toContainText("28–30 sep");
    await expect(semana(page, "GIRONA", 5).locator(".md-sh .v")).toHaveText("33 m²");
    await expect(page.locator("#mdNext")).toBeEnabled();
    await page.click("#mdNext");
    await expect(page.locator("#mdNext")).toBeDisabled();
    await expect(semana(page, "GIRONA", 1).locator(".md-sh .v")).toHaveText("50,5 m²");
    await expect(semana(page, "GIRONA", 2).locator(".md-sh .v")).toHaveText("20 m²");
    await expect(tarjeta(page, "GIRONA").locator(".md-tot b")).toHaveText("70,5 m²");
    await expect(page.locator("#mkM2")).toHaveText("70,5");
  });

  test("recuerda el trabajo, el precio y la cuadrilla de cada obra", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await page.click("#mdNueva");
    await page.selectOption("#mfObra", "2415");
    await expect(page.locator("#mfOps .chk")).toHaveText(["Ahmed Khan", "José Moreno", "Sergi Ferrer"]);
    await page.locator("#mfOps .chk", { hasText: "Ahmed Khan" }).click();
    await page.fill("#mfOtros", "Pep Soler");
    await anota(page, { trabajo: "Tabique de pladur", cantidad: "60", precio: "11,5" });
    await expect(semana(page, "2415", 2).locator(".md-l")).toContainText("Ahmed Khan, Pep Soler · 11,50 €/m²");
    await tarjeta(page, "2415").getByRole("button", { name: "Anotar en 2415" }).click();
    await expect(page.locator("#mfTipo")).toHaveValue("Tabique de pladur");
    await expect(page.locator("#mfP")).toHaveValue("11,5");
    await expect(page.locator("#mfOps input:checked")).toHaveCount(1);
    await expect(page.locator("#mfOtros")).toHaveValue("Pep Soler");
    await expect(page.locator("#mfQ")).toHaveValue("");
  });

  test("la lista trae los trabajos con su unidad: m³ solo el vertido de hormigón", async ({ page }) => {
    await abrir(page);
    await page.click("#mdNueva");
    const grupos = await page.locator("#mfTipo optgroup").evaluateAll((gs) => gs.map((g) => g.label));
    expect(grupos).toEqual(["Yeso y pladur", "Cerámica (rajola)", "Hormigón (vertido)", "Albañilería", "Acabados"]);
    const opciones = await page.locator("#mfTipo optgroup option").evaluateAll((os) => os.map((o) => [o.value, o.textContent.split(" · ").pop()]));
    expect(opciones.filter(([, u]) => u !== "m²" && u !== "m³")).toEqual([]);
    expect(opciones.filter(([, u]) => u === "m³").map(([t]) => t)).toEqual(["Vertido de hormigón en cimentación", "Vertido de hormigón en muros",
      "Vertido de hormigón en pilares", "Vertido de hormigón en forjado o losa"]);
    for (const [t, u] of [["Alicatado de rajola", "m²"], ["Vertido de hormigón en muros", "m³"], ["Bloque de hormigón", "m²"], ["Yeso proyectado", "m²"]]) {
      await page.selectOption("#mfTipo", t);
      await expect(page.locator("#mfQu")).toHaveText(u);
      await expect(page.locator("#mfQlbl")).toHaveText(`en ${u}`);
    }
    // en el suelo y en el techo no hay puertas ni ventanas que restar
    for (const t of ["Solado de rajola", "Techo de pladur"]) {
      await page.selectOption("#mfTipo", t);
      await expect(page.locator("#mfPuerta")).toBeHidden();
      await expect(page.locator("#mfHuecoAdd")).toHaveText("Restar hueco");
    }
    await expect(page.locator("#mfCrit")).toContainText("No se descuentan los huecos para instalaciones");
    await page.selectOption("#mfTipo", "__otro");
    await page.fill("#mfTrab", "Picado de paredes");
    await expect(page.locator("#mfCrit")).toContainText("Trabajo fuera de la lista: los huecos se restan enteros.");
    await expect(page.locator("#mfQu")).toHaveText("m²");
  });

  test("vertido en muros (m³): se restan los huecos de más de 2 m², los pequeños no", async ({ page }) => {
    await abrir(page);
    await page.click("#mdNueva");
    await page.selectOption("#mfObra", "VILABLAREIX");
    await page.selectOption("#mfTipo", "Vertido de hormigón en muros");
    await expect(page.locator("#mfPuerta")).toBeHidden();
    await page.locator("#mfPanos summary").click();
    await expect(page.locator("#mfPanosHint")).toContainText("Largo × ancho × canto");
    await page.click("#mfPanoAdd");
    await page.fill("#mpl0", "10"); await page.fill("#mpa0", "0,30"); await page.fill("#mpe0", "2,5"); await page.fill("#mpn0", "2");
    await expect(page.locator("#mpv0")).toHaveText("15 m³");
    await page.click("#mfHuecoAdd");            // 1 × 2 = 2 m²: no pasa de 2, no se resta
    await page.fill("#mpl1", "1"); await page.fill("#mpa1", "2"); await page.fill("#mpe1", "0,3");
    await expect(page.locator("#mpv1")).toHaveText("No se resta (2 m² c/u)");
    await page.click("#mfHuecoAdd");            // 1,5 × 2 = 3 m² → 3 × 0,30 = 0,9 m³
    await page.fill("#mpl2", "1,5"); await page.fill("#mpa2", "2"); await page.fill("#mpe2", "0,3");
    await expect(page.locator("#mpv2")).toHaveText("− 0,9 m³");
    await expect(page.locator("#mfNetoV")).toHaveText("14,1 m³");
    await page.click("#mfGuardar");
    await expect(page.locator("#mdOk")).toHaveText("Guardado: 14,1 m³ de Vertido de hormigón en muros en VILABLAREIX · semana 2 (5–11 oct).");
    await expect(tarjeta(page, "VILABLAREIX").locator(".md-tot b")).toHaveText("14,1 m³");
    await expect(page.locator("#mkM2")).toHaveText("0");
  });
  test("otro trabajo escrito a mano queda en la lista para la próxima", async ({ page }) => {
    await abrir(page);
    await anota(page, { obra: "AMETLLA", trabajo: "Picado de paredes", cantidad: "18" });
    await expect(semana(page, "AMETLLA", 2).locator(".md-l")).toContainText("Picado de paredes");
    await page.click("#mdNueva");
    await expect(page.locator('#mfTipo optgroup[label="Escritos antes"] option')).toHaveText(["Picado de paredes"]);
    await page.click("#mfCancelar");
    await semana(page, "AMETLLA", 2).locator(".md-l").click();
    await expect(page.locator("#mfTipo")).toHaveValue("Picado de paredes");
    await expect(page.locator("#mfOtroBox")).toBeHidden();
  });

  test("corregir y borrar", async ({ page }) => {
    await abrir(page);
    await anota(page, { obra: "PALAMOS", trabajo: "Pintura plástica sobre yeso", cantidad: "200" });
    await semana(page, "PALAMOS", 2).locator(".md-l").click();
    await expect(page.locator("#mfTit")).toHaveText("Corregir medición");
    await expect(page.locator("#mfQ")).toHaveValue("200");
    await page.fill("#mfQ", "210,5");
    await page.click("#mfGuardar");
    await expect(page.locator("#mdOk")).toHaveText("Corregido: 210,5 m² de Pintura plástica sobre yeso en PALAMOS · semana 2 (5–11 oct).");
    expect(await page.evaluate(() => state.meds.length)).toBe(1);
    await semana(page, "PALAMOS", 2).locator(".md-l").click();
    await page.click("#mfBorrar");
    await expect(page.locator("#mdOk")).toHaveText("Medición borrada.");
    await expect(tarjeta(page, "PALAMOS").locator(".md-tot b")).toHaveText("0 m²");
    await page.reload();
    expect(await page.evaluate(() => state.meds.length)).toBe(0);
  });

  test("avisa de lo que falta y no guarda datos malos", async ({ page }) => {
    await abrir(page);
    await page.click("#mdNueva");
    await page.click("#mfGuardar");
    await expect(page.locator("#mfHint")).toHaveText("Elige el trabajo de la lista.");
    await expect(page.locator("#mfTipo")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#mfTipo")).toBeFocused();
    await page.selectOption("#mfTipo", "__otro");
    await expect(page.locator("#mfTrab")).toBeFocused();
    await page.click("#mfGuardar");
    await expect(page.locator("#mfHint")).toHaveText("Escribe qué trabajo se ha hecho.");
    await eligeTrabajo(page, "Yeso proyectado");
    await page.fill("#mfQ", "mucho");
    await page.click("#mfGuardar");
    await expect(page.locator("#mfHint")).toHaveText("Pon la cantidad hecha, por ejemplo 135.");
    await page.fill("#mfQ", "1.250,75 m2");
    await page.fill("#mfP", "doce");
    await page.click("#mfGuardar");
    await expect(page.locator("#mfHint")).toContainText("El precio no se entiende");
    await page.fill("#mfP", "");
    await page.fill("#mfFecha", "2026-10-09");
    await page.click("#mfGuardar");
    await expect(page.locator("#mfHint")).toContainText("no puede ser en el futuro");
    expect(await page.evaluate(() => state.meds.length)).toBe(0);
    await page.fill("#mfFecha", "2026-10-08");
    await page.click("#mfGuardar");
    await expect(tarjeta(page, "BLANES").locator(".md-tot b")).toHaveText("1.250,75 m²");
    // cancelar no guarda nada
    await page.click("#mdNueva");
    await eligeTrabajo(page, "Otra cosa");
    await page.fill("#mfQ", "5");
    await page.click("#mfCancelar");
    expect(await page.evaluate(() => state.meds.length)).toBe(1);
  });

  test("datos rotos en las mediciones no rompen la pantalla", async ({ page }) => {
    const problemas = vigilar(page);
    await sembrarReales(page, { v: 2, obras: [{ cod: "BLANES", dir: "Blanes" }],
      meds: [null, { id: "a", fecha: "mal", obra: "BLANES", trab: "x", u: "m²", q: 1 }, { id: "b", fecha: "2026-10-02", obra: "BLANES", trab: "Yeso", u: "pies", q: 3 },
        { id: "c", fecha: "2026-10-02", obra: "BLANES", trab: "Yeso", u: "m²", q: -4 },
        { id: "d", fecha: "2026-10-02", obra: "BLANES", trab: "Yeso", u: "m²", q: 12, ops: "Ana", panos: [{ l: "x" }, { l: 2, a: 3, n: 2 }], p: "caro" },
        { id: "e", fecha: "2026-10-03", obra: "OBRA-BORRADA", trab: "Solado", u: "m²", q: 7 }] });
    await abrir(page);
    expect(await page.evaluate(() => state.meds.map((m) => [m.id, m.ops, m.panos.length, m.p]))).toEqual([["d", [], 1, null], ["e", [], 0, null]]);
    await expect(tarjeta(page, "OBRA-BORRADA").locator(".md-tot b")).toHaveText("7 m²");
    await expect(tarjeta(page, "OBRA-BORRADA")).toContainText("Sin dirección");
    expect(problemas).toEqual([]);
  });
});

test.describe("certificación del mes", () => {
  async function mesConDatos(page) {
    await abrir(page);
    await anota(page, { obra: "BLANES", fecha: "2026-10-08", trabajo: "Guarnecido y enlucido de yeso", cantidad: "135", zona: "Planta 2" });
    await anota(page, { obra: "BLANES", fecha: "2026-10-02", trabajo: "Guarnecido y enlucido de yeso", cantidad: "27,45", nota: "Escalera" });
    await anota(page, { obra: "PALAMOS", fecha: "2026-10-06", trabajo: "Alicatado de rajola", cantidad: "80", precio: "9,50" });
    await anota(page, { obra: "PALAMOS", fecha: "2026-10-07", trabajo: "Vertido de hormigón en pilares", cantidad: "30", precio: "" });
  }

  test("el Excel trae cada medición y el resumen por obra y semana", async ({ page }) => {
    await mesConDatos(page);
    await expect(page.locator("#mkM2")).toHaveText("242,45");
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#mdCsv")]);
    expect(descarga.suggestedFilename()).toBe("mediciones-2026-10.csv");
    const crudo = readFileSync(await descarga.path(), "utf8");
    expect(crudo.startsWith("﻿")).toBe(true);
    const f = leeCsv(crudo);
    expect(f[0]).toEqual(["Certificación de mediciones", "Amra Building", "octubre 2026"]);
    expect(f[2].slice(0, 5)).toEqual(["Semana del mes", "Del", "Al", "Fecha", "Código de obra"]);
    const detalle = f.slice(3, 7);
    expect(detalle.map((r) => [r[0], r[3], r[4], r[7], r[11], r[12], r[13], r[14], r[15]])).toEqual([
      ["S1", "02/10/2026", "BLANES", "Guarnecido y enlucido de yeso", "27,45", "m²", "", "", "Escalera"],
      ["S2", "08/10/2026", "BLANES", "Guarnecido y enlucido de yeso", "135", "m²", "", "", ""],
      ["S2", "06/10/2026", "PALAMOS", "Alicatado de rajola", "80", "m²", "9,50", "760,00", ""],
      ["S2", "07/10/2026", "PALAMOS", "Vertido de hormigón en pilares", "30", "m³", "", "", ""],
    ]);
    expect(detalle[1][5]).toBe("Calle de prueba 1 · Blanes");
    const i = f.findIndex((r) => r[0] === "Resumen por obra y semana");
    expect(f[i + 1]).toEqual(["Código de obra", "Dirección", "Unidad", "S1 (1–4 oct)", "S2 (5–11 oct)", "S3 (12–18 oct)", "S4 (19–25 oct)", "S5 (26–31 oct)", "Total del mes", "Importe (€)"]);
    expect(f.slice(i + 2)).toEqual([
      ["BLANES", "Calle de prueba 1 · Blanes", "m²", "27,45", "135", "", "", "", "162,45", ""],
      ["PALAMOS", "Calle de prueba 2 · Palamós", "m²", "", "80", "", "", "", "80", "760,00"],
      ["PALAMOS", "Calle de prueba 2 · Palamós", "m³", "", "30", "", "", "", "30", ""],
      ["TOTAL", "", "m²", "27,45", "215", "", "", "", "242,45", "760,00"],
      ["TOTAL", "", "m³", "", "30", "", "", "", "30", ""],
    ]);
    // solo una obra
    await page.selectOption("#mdExpObra", "BLANES");
    const [d2] = await Promise.all([page.waitForEvent("download"), page.click("#mdCsv")]);
    expect(d2.suggestedFilename()).toBe("mediciones-2026-10-obra-BLANES.csv");
    const f2 = leeCsv(readFileSync(await d2.path(), "utf8"));
    expect(f2.filter((r) => r[4] === "PALAMOS")).toEqual([]);
    expect(f2.at(-1)).toEqual(["TOTAL", "", "m²", "27,45", "135", "", "", "", "162,45", ""]);
  });

  test("el resumen para WhatsApp, línea a línea", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.share = (d) => { window.__compartido = { text: d.text, title: d.title, files: (d.files || []).map((f) => f.name) }; return Promise.resolve(); };
      navigator.canShare = () => true;
    });
    await mesConDatos(page);
    await page.click("#mdEnviar");
    await expect(page.locator("#mdHint")).toHaveText("Resumen enviado.");
    const c = await page.evaluate(() => window.__compartido);
    expect(c.files).toEqual(["mediciones-2026-10.csv"]);
    expect(c.text.split("\n")).toEqual([
      "Mediciones octubre 2026 · Amra Building",
      "",
      "BLANES (Calle de prueba 1 · Blanes): 162,45 m²",
      "  Semana 1 (1–4 oct): Guarnecido y enlucido de yeso 27,45 m²",
      "  Semana 2 (5–11 oct): Guarnecido y enlucido de yeso 135 m²",
      "",
      "PALAMOS (Calle de prueba 2 · Palamós): 80 m² · 30 m³ · 760,00 €",
      "  Semana 2 (5–11 oct): Alicatado de rajola 80 m²; Vertido de hormigón en pilares 30 m³",
      "",
      "Total del mes: 242,45 m² · 30 m³ · 760,00 €",
    ]);
  });

  test("sin compartir en el navegador, el resumen se copia", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => { delete Navigator.prototype.share; });
    await mesConDatos(page);
    await page.click("#mdEnviar");
    await expect(page.locator("#mdHint")).toHaveText(/Resumen copiado|No se ha podido copiar solo/);
    const visible = await page.locator("#mdResp").isVisible();
    const texto = visible ? await page.locator("#mdResp").inputValue() : await page.evaluate(() => navigator.clipboard.readText());
    expect(texto).toContain("Total del mes: 242,45 m² · 30 m³ · 760,00 €");
  });

  test("el PDF: resumen, detalle por semana y firmas", async ({ page }, info) => {
    await mesConDatos(page);
    await page.evaluate(() => { window.print = () => { window.__impreso = true; }; });
    await page.selectOption("#mdExpObra", "BLANES");
    await page.click("#mdPdf");
    expect(await page.evaluate(() => window.__impreso)).toBe(true);
    const host = page.locator("#printHost");
    await expect(host.locator("h1")).toHaveText("Amra Building · Certificación de mediciones");
    await expect(host).toContainText("Octubre 2026 · obra BLANES · Calle de prueba 1 · Blanes");
    await expect(host.locator(".inf-k")).toHaveText("162,45 m² · 1 obra · 2 mediciones");
    await expect(host.locator("tfoot tr")).toHaveText(/Total del mes\s*m²\s*27,45\s*135\s*162,45/);
    await expect(host.locator(".md-semana")).toHaveText(["Semana 1 · 1–4 oct · 27,45 m²", "Semana 2 · 5–11 oct · 135 m²"]);
    await expect(host.locator(".inf-firmas div")).toHaveCount(2);
    await expect(host).not.toContainText("PALAMOS");
    if (CAPTURAS && info.project.name === "escritorio-1440") {
      await page.selectOption("#mdExpObra", "");
      await page.click("#mdPdf");
      await page.emulateMedia({ media: "print" });
      await page.pdf({ path: `${CAPTURAS}/certificacion-mediciones.pdf`, preferCSSPageSize: true, printBackground: true });
      await page.emulateMedia({ media: "screen" });
    }
  });
});

test.describe("parte semanal para el jefe", () => {
  async function semanaConDatos(page) {
    await abrir(page);
    await anota(page, { obra: "BLANES", fecha: "2026-10-06", trabajo: "Guarnecido y enlucido de yeso", cantidad: "135", zona: "Planta 2" });
    await anota(page, { obra: "VILABLAREIX", fecha: "2026-10-07", trabajo: "Vertido de hormigón en pilares", cantidad: "3,6" });
    await anota(page, { obra: "BLANES", fecha: "2026-10-02", trabajo: "Alicatado de rajola", cantidad: "20" });   // semana anterior
  }
  function comprobarPDF(pdf) {
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const xref = Number(pdf.match(/startxref\n(\d+)\n%%EOF/)[1]);
    expect(pdf.slice(xref, xref + 5)).toBe("xref\n");
    const entradas = pdf.slice(xref).split("\n").slice(3).filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
    entradas.forEach((off, i) => expect(pdf.slice(off, off + String(i + 1).length + 6)).toBe(`${i + 1} 0 obj`));
    for (const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const ini = m.index + m[0].length;
      expect(pdf.slice(ini + Number(m[1]), ini + Number(m[1]) + 10)).toBe("\nendstream");
    }
  }

  test("resume la semana y genera un PDF de verdad", async ({ page }) => {
    const problemas = vigilar(page);
    await semanaConDatos(page);
    await expect(page.locator("#mpTit")).toHaveText("Semana 41");
    await expect(page.locator("#mpRango")).toHaveText("5 – 11 oct 2026");
    await expect(page.locator("#mpRes")).toContainText("BLANES 135 m² · VILABLAREIX 3,6 m³");
    await expect(page.locator("#mpRes")).toContainText("Sin medición: PALAMOS, GIRONA, AMETLLA");
    await expect(page.locator("#mpNext")).toBeDisabled();
    const [d] = await Promise.all([page.waitForEvent("download"), page.click("#mpDescargar")]);
    expect(d.suggestedFilename()).toBe("parte-mediciones-2026-S41.pdf");
    await expect(page.locator("#mpHint")).toHaveText("PDF descargado: parte-mediciones-2026-S41.pdf.");
    const pdf = readFileSync(await d.path()).toString("latin1");
    comprobarPDF(pdf);
    for (const t of ["(Semana 41)", "(Parte semanal de mediciones)", "(135 m\xb2)", "(3,6 m\xb3)", "(Sin medici\xf3n esta semana)", "(Planta 2)", "(P\xe1gina 1 de 1)", "/Im1 Do"])
      expect(pdf).toContain(t);
    expect(pdf).not.toContain("(Alicatado de rajola)");     // es de la semana anterior
    await page.click("#mpPrev");
    await expect(page.locator("#mpTit")).toHaveText("Semana 40");
    await expect(page.locator("#mpRes")).toContainText("BLANES 20 m²");
    if (CAPTURAS && test.info().project.name === "escritorio-1440") {
      await page.click("#mpNext");
      const [d2] = await Promise.all([page.waitForEvent("download"), page.click("#mpDescargar")]);
      await d2.saveAs(`${CAPTURAS}/parte-semanal-mediciones.pdf`);
    }
    expect(problemas).toEqual([]);
  });

  test("«Enviar PDF por WhatsApp» comparte el archivo PDF", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => true;
      navigator.share = async (d) => {
        const f = d.files[0];
        window.__parte = { n: f.name, t: f.type, cab: await f.slice(0, 8).text(), text: d.text };
      };
    });
    await semanaConDatos(page);
    await page.click("#mpEnviar");
    await expect(page.locator("#mpHint")).toHaveText("Parte enviado.");
    const c = await page.evaluate(() => window.__parte);
    expect(c).toEqual({ n: "parte-mediciones-2026-S41.pdf", t: "application/pdf", cab: "%PDF-1.4",
      text: "Parte semanal de mediciones · Semana 41 (5 – 11 oct 2026): 135 m² · 3,6 m³." });
  });

  test("una semana con mucho trabajo ocupa varias páginas, con pie en cada una", async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => {
      for (let i = 0; i < 45; i++) state.meds.push({ id: "m" + i, fecha: "2026-10-0" + (5 + (i % 4)), obra: ["BLANES", "PALAMOS", "GIRONA"][i % 3],
        trab: "Guarnecido y enlucido de yeso", u: "m²", q: 10 + i, zona: "Planta " + (i % 6), ops: ["Ahmed Khan", "José Moreno"], p: null,
        panos: [], nota: i % 5 ? "" : "Repaso de esquinas y mochetas en la escalera", creado: "2026-10-08T08:" + String(i).padStart(2, "0") });
      save(); pintaMediciones();
    });
    const [d] = await Promise.all([page.waitForEvent("download"), page.click("#mpDescargar")]);
    const pdf = readFileSync(await d.path()).toString("latin1");
    comprobarPDF(pdf);
    const paginas = (pdf.match(/\/Type \/Page /g) || []).length;
    expect(paginas).toBeGreaterThan(1);
    for (let i = 1; i <= paginas; i++) expect(pdf).toContain(`(P\xe1gina ${i} de ${paginas})`);
  });

  test("sin mediciones en la semana no deja enviar", async ({ page }) => {
    await abrir(page);
    await expect(page.locator("#mpRes")).toHaveText("Sin mediciones esta semana.");
    await expect(page.locator("#mpEnviar")).toBeDisabled();
    await expect(page.locator("#mpDescargar")).toBeDisabled();
  });
});

test.describe("calidad", () => {
  async function pantallaLlena(page) {
    await sembrarReales(page);
    await abrir(page);
    await anota(page, { obra: "2415", trabajo: "Placa de yeso laminado (pladur) en techos de vivienda", cantidad: "1.234,56", zona: "Planta 4 · viviendas 4-1 a 4-4", precio: "12,75", nota: "Falta repasar juntas en el pasillo" });
    await anota(page, { obra: "2501", trabajo: "Vertido de hormigón en pilares", cantidad: "4" });
    await page.locator("#mdTiles .md-tile").first().click();
    await page.click("#mdNueva");
    await page.locator("#mfPanos summary").click();
    await page.click("#mfPanoAdd");
    await page.click("#mfVentana");
    await page.click("#mfHuecoAdd");
  }

  test("no desborda con el formulario abierto, paños y nombres largos", async ({ page }) => {
    await pantallaLlena(page);
    await sinDesbordes(page, "mediciones");
    if (CAPTURAS && ["movil-390", "escritorio-1440"].includes(test.info().project.name)) {
      await page.screenshot({ path: `${CAPTURAS}/mediciones-formulario-${test.info().project.name}.png`, fullPage: true });
      await page.click("#mfCancelar");
      await page.screenshot({ path: `${CAPTURAS}/mediciones-${test.info().project.name}.png`, fullPage: true });
    }
  });

  test("accesibilidad sin fallos graves (axe, WCAG 2.1 AA)", async ({ page }, info) => {
    test.skip(!["movil-390", "escritorio-1440"].includes(info.project.name), "basta con móvil y escritorio");
    await pantallaLlena(page);
    const graves = [];
    for (const donde of ["formulario", "lista"]) {
      if (donde === "lista") await page.click("#mfCancelar");
      const r = await new AxeBuilder({ page }).include("#s-medicion").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) graves.push(`${donde}: ${v.id} [${v.impact}] (${v.nodes.length}) ${v.nodes[0].target}`);
    }
    expect(graves).toEqual([]);
  });

  test("todo se pulsa con guantes (44 px)", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("movil"), "solo móvil");
    await pantallaLlena(page);
    const pequenos = await page.evaluate(() =>
      [...document.querySelectorAll("#s-medicion button, #s-medicion input, #s-medicion select, #s-medicion summary, #s-medicion .seg label")]
        .filter((el) => el.offsetParent !== null && !(el.type === "radio") && !(el.type === "checkbox"))
        .map((el) => [el.id || el.textContent.trim().slice(0, 30), Math.round(el.getBoundingClientRect().height)])
        .filter(([, h]) => h < 44),
    );
    expect(pequenos).toEqual([]);
  });

  test("con teclado: Mediciones es la primera pestaña", async ({ page }) => {
    await abrir(page);
    await page.getByRole("tab", { name: "Mediciones" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Nuevo albarán" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: "Mediciones" })).toHaveAttribute("aria-selected", "true");
  });
});
