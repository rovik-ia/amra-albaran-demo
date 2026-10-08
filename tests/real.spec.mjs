// Tus datos (la app sin ?demo): lo que se usa a diario en obra.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { HOY, KEY_REAL, KEY_DEMO, vigilar, irA, sinDesbordes, datosReales, sembrarReales } from "./comun.mjs";

const PANTALLAS = ["Mediciones", "Nuevo albarán", "Obras", "Visitas", "Semana", "Control", "Albaranes", "Ajustes"];
const FOTO = new URL("../icon-512.png", import.meta.url).pathname;

async function abrir(page, fecha = HOY) {
  await page.clock.setFixedTime(fecha);
  page.on("dialog", (d) => d.accept());
  await page.goto("./");
  await expect(page.locator(".topbar")).toBeVisible();
}
function tarjetaObra(page, cod) {
  return page.locator(".ocard", { has: page.locator(".oc-head .cod", { hasText: cod }) });
}

test.describe("empieza limpio", () => {
  test("sin datos: todo vacío y te lleva a Obras", async ({ page }) => {
    const problemas = vigilar(page);
    await abrir(page);
    await expect(page.getByRole("tab", { name: "Obras" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#koObras")).toHaveText("0");
    await expect(page.locator("#koGente")).toHaveText("0");
    await expect(page.locator("#chipModo")).toHaveText("Tus datos");
    await expect(page.getByRole("tab", { name: "Cierre de mes" })).toBeHidden();
    await irA(page, "Nuevo albarán");
    await expect(page.locator("#nuevoVacio")).toBeVisible();
    await expect(page.locator("#emitir")).toBeHidden();
    await irA(page, "Albaranes");
    await expect(page.locator("#listaAlb")).toContainText("Todavía no hay albaranes");
    for (const p of PANTALLAS) await irA(page, p);
    expect(problemas).toEqual([]);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY_DEMO)).toBeNull();
  });

  test("la demo y tus datos no se mezclan", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await page.goto("./?demo");
    await expect(page.locator("#chipModo")).toContainText("datos de ejemplo");
    await irA(page, "Obras");
    await expect(page.locator("#obrasLista")).not.toContainText("Promociones Valldaura");
    await irA(page, "Ajustes");
    await page.getByRole("button", { name: "Reiniciar la demo" }).click();
    await irA(page, "Ajustes");
    await page.getByRole("link", { name: "Volver a mis datos" }).click();
    await irA(page, "Obras");
    await expect(page.locator("#obrasLista")).toContainText("Promociones Valldaura");
  });
});

test.describe("obras y personal", () => {
  test("da de alta obras y personal a mano y pegando desde Excel", async ({ page }) => {
    await abrir(page);
    await page.fill("#noCod", "2415");
    await page.fill("#noCli", "Promociones Valldaura SL");
    await page.fill("#noDir", "Pg. de Valldaura 120 · Barcelona");
    await page.fill("#noEnc", "Karim Benali");
    await page.fill("#noJefe", "Jordi Sala");
    await page.fill("#noTel", "600 111 222");
    await page.click("#noAdd");
    await expect(page.locator("#obrasHint")).toContainText("Obra 2415 añadida");
    await expect(page.locator("#altaPersona")).toHaveAttribute("open", "");
    await page.fill("#nwNombre", "Ahmed Khan");
    await page.locator("#nwCat").selectOption("Oficial 1ª");
    await page.fill("#nwDni", "x1234567l");
    await page.click("#nwAdd");
    await expect(tarjetaObra(page, "2415").locator(".wrow")).toContainText("Ahmed Khan");
    await page.fill("#nwNombre", "ahmed khan");
    await page.click("#nwAdd");
    await expect(page.locator("#obrasHint")).toContainText("ya está en la plantilla");

    await page.locator("#pegar summary").click();
    await page.fill("#pegarTxt", [
      "Nombre\tCategoría\tObra\tDNI",
      "José Moreno\tOf. 2ª\t2415\t12345678Z",
      "Sergi Ferrer\tpeón\t2415\t",
      "Rashid Ali\tPeón especialista\t2501\tY7654321B\t612 345 678",
      "\t\t2415\t",
    ].join("\n"));
    await page.click("#pegarBtn");
    await expect(page.locator("#obrasHint")).toContainText("Añadidas 3 personas");
    await expect(page.locator("#obrasHint")).toContainText("Obras nuevas: 2501");
    await expect(page.locator("#koGente")).toHaveText("4");
    const plantilla = await page.evaluate(() => PLANTILLA.map((w) => [w.n, w.c, w.obra, w.dni]));
    expect(plantilla).toEqual([
      ["Ahmed Khan", "Oficial 1ª", "2415", "X1234567L"],
      ["José Moreno", "Oficial 2ª", "2415", "12345678Z"],
      ["Sergi Ferrer", "Peón ordinario", "2415", ""],
      ["Rashid Ali", "Peón especialista", "2501", "Y7654321B"],
    ]);
    await page.reload();
    await irA(page, "Obras");
    await expect(tarjetaObra(page, "2501").locator(".wrow")).toContainText("Rashid Ali");
    await expect(tarjetaObra(page, "2415")).toContainText("Karim Benali");
  });

  test("cambia personal de obra y queda apuntado", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Obras");
    const destino = tarjetaObra(page, "2501");
    await destino.locator(".traer summary").click();
    await destino.locator(".pick", { hasText: "Sergi Ferrer" }).click();
    await destino.locator(".pick", { hasText: "José Moreno" }).click();
    await destino.locator("[data-traer]").click();
    await expect(page.locator("#obrasHint")).toContainText("Pasan a la obra 2501");
    await expect(tarjetaObra(page, "2501").locator(".oc-crew")).toContainText("Sergi Ferrer");
    await expect(tarjetaObra(page, "2415").locator(".oc-crew")).not.toContainText("Sergi Ferrer");
    // y uno de vuelta con el selector de su ficha
    await tarjetaObra(page, "2501").locator(".wrow summary", { hasText: "José Moreno" }).click();
    await tarjetaObra(page, "2501").locator(".wrow[open]").getByLabel("Obra").selectOption("2415");
    await expect(tarjetaObra(page, "2415").locator(".oc-crew")).toContainText("José Moreno");
    // las tallas de EPIs quedan en su ficha
    await tarjetaObra(page, "2415").locator(".wrow summary", { hasText: "José Moreno" }).click();
    await tarjetaObra(page, "2415").locator(".wrow[open]").getByLabel("Tallas de EPIs").fill("Botas 43 · guantes 10");
    await tarjetaObra(page, "2415").locator(".wrow[open]").getByLabel("Tallas de EPIs").press("Tab");
    expect(await page.evaluate(() => PLANTILLA.find((w) => w.n === "José Moreno").talla)).toBe("Botas 43 · guantes 10");
    const movs = await page.evaluate(() => state.movs.map((m) => `${m.n} ${m.de}>${m.a}`));
    expect(movs).toEqual(["José Moreno 2415>2501", "Sergi Ferrer 2415>2501", "José Moreno 2501>2415"]);
    await irA(page, "Semana");
    await expect(page.locator("#semMovs")).toContainText("Sergi Ferrer");
  });

  test("Cómo llegar abre tu enlace de Google Maps o busca la dirección", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Obras");
    const obra = tarjetaObra(page, "2415");
    await expect(obra.getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=Pg\.%20de%20Valldaura/);
    await obra.locator(".oedit:not(.traer) summary").click();
    const campo = obra.getByLabel("Ubicación en Google Maps");
    await campo.fill("javascript:alert(1)");
    await campo.press("Tab");
    await expect(page.locator("#obrasHint")).toContainText("no es un enlace de Google Maps");
    await expect(campo).toHaveValue("");
    await campo.fill("https://maps.app.goo.gl/Xy12AbC");
    await campo.press("Tab");
    await expect(obra.getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("href", "https://maps.app.goo.gl/Xy12AbC");
    await expect(obra.getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("target", "_blank");
    await expect(obra.getByRole("link", { name: "Llamar a Jordi" })).toHaveAttribute("href", "tel:+34600111222");
    await page.reload();
    await irA(page, "Obras");
    await expect(tarjetaObra(page, "2415").getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("href", "https://maps.app.goo.gl/Xy12AbC");
  });
});

test.describe("albaranes en papel", () => {
  test("pasa un albarán con foto y sigue ahí al recargar", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Nuevo albarán");
    await expect(page.locator("#titNuevo")).toHaveText("Pasar un albarán");
    await expect(page.locator("#segPaso")).toBeHidden();
    const boton = page.getByRole("button", { name: "Guardar albarán" });
    await expect(boton).toBeDisabled();
    await page.fill("#numPapel", "4514");
    await page.fill("#fecha", "2026-09-30");
    await page.getByRole("button", { name: "Incluir a Ahmed Khan" }).click();
    await page.getByRole("button", { name: "Media hora más a Ahmed Khan" }).click();
    await expect(page.locator("#emitirHint")).toContainText("firma y fecha");
    await page.locator("#zonaPapel label", { hasText: "Sí, completo" }).click();
    await expect(page.locator("#emitirHint")).toContainText("nombre de quien firma");
    await page.fill("#firmante", "Jordi Sala");
    await expect(page.locator("#emitirHint")).toContainText("Sin foto quedará pendiente");
    await page.setInputFiles("#fotoIn", FOTO);
    await expect(page.locator("#fotoPrev")).toBeVisible();
    await boton.click();
    const papel = page.locator("#paperHost .paper");
    await expect(papel).toContainText("Nº 4514");
    await expect(papel).toContainText("Promociones Valldaura SL");
    await expect(papel).toContainText("Karim Benali");
    await expect(papel).toContainText("8,5 h");
    await expect(papel.locator(".paper-foto img")).toBeVisible();
    await page.reload();
    await irA(page, "Albaranes");
    await page.locator(".alb", { hasText: "4514" }).click();
    await expect(page.locator("#paperHost .paper-foto img")).toBeVisible();
    const lado = await page.locator("#paperHost .paper-foto img").evaluate((img) => Math.max(img.naturalWidth, img.naturalHeight));
    expect(lado).toBeLessThanOrEqual(1400);
  });

  test("no deja repetir un número del mismo talonario", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Nuevo albarán");
    await page.fill("#numPapel", "4512");
    await expect(page.locator("#emitirHint")).toContainText("ya está pasado en esta obra");
    await page.locator(".obra", { hasText: "2501" }).click();
    await expect(page.locator("#emitirHint")).not.toContainText("ya está pasado");
    await irA(page, "Ajustes");
    await page.locator("#talonarioModo label", { hasText: "Uno para todas" }).click();
    await irA(page, "Nuevo albarán");
    await page.locator(".obra", { hasText: "2501" }).click();
    await page.fill("#numPapel", "4512");
    await expect(page.locator("#emitirHint")).toContainText("ya está pasado");
  });

  test("anular un albarán lo saca de las horas", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Semana");
    await expect(page.locator("#swH")).toHaveText("41");
    await irA(page, "Albaranes");
    await page.locator(".alb", { hasText: "000210" }).click();
    await page.getByRole("button", { name: "Anular albarán" }).click();
    await expect(page.locator("#paperHost .sello-anulado")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".alb", { hasText: "000210" })).toContainText("Anulado");
    await irA(page, "Semana");
    await expect(page.locator("#swH")).toHaveText("32");
  });
});

test.describe("control, visitas y material", () => {
  test("cruza visitas y albaranes: quién falta, quién sobra y qué está sin firmar", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Control");
    await expect(page.locator("#fugaK")).toContainText("Visto en obra sin albarán");
    await expect(page.locator("#fugaE")).toHaveText("8 h");
    await expect(page.locator("#huecos")).toContainText("José Moreno");
    const pend = page.locator("#pendientes");
    await expect(pend).toContainText("Albarán sin firma ni foto");
    await expect(pend.locator(".aviso", { hasText: "no viste en obra" })).toContainText("Sergi Ferrer");
    await expect(pend).toContainText("Día laborable sin albarán");
    await expect(pend.locator(".aviso", { hasText: "Día laborable" })).toContainText("2501");
    await expect(pend.locator(".aviso", { hasText: "Día laborable" })).toContainText("28/09/2026");
    await expect(page.locator(".tal-row", { hasText: "2415" })).toContainText("correlativo correcto");
    await pend.locator("button.aviso", { hasText: "sin firma" }).click();
    await expect(page.locator("#paperHost")).toContainText("Falta firma y fecha");
  });

  test("no reclama albaranes de antes de empezar con la app", async ({ page }) => {
    await sembrarReales(page, datosReales({ inicio: "2026-09-30" }));
    await abrir(page);
    await irA(page, "Control");
    await expect(page.locator("#pendientes")).not.toContainText("Día laborable sin albarán");
  });

  test("la visita apunta presentes, estado y los EPIs que faltan", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Visitas");
    await page.locator("#visObra").selectOption("2501");
    await expect(page.locator("#visCon")).toHaveValue("Nuria Prat · jefe de obra");
    await page.getByRole("button", { name: "Guardar visita" }).click();
    await expect(page.locator("#visHint")).toContainText("cómo va la obra");
    await page.getByRole("button", { name: "Rashid Ali está en obra" }).click();
    await expect(page.locator("#visN")).toHaveText("1");
    await page.locator("#visEstado label", { hasText: "Riesgo" }).click();
    await page.locator("#visFaltas label", { hasText: "Casco" }).click();
    await page.locator("#visFaltas label", { hasText: "Arnés" }).click();
    await page.fill("#visFaltaDet", "Para Rashid, trabajo en cubierta");
    await page.getByRole("button", { name: "Guardar visita" }).click();
    await expect(page.locator("#visHint")).toContainText("apuntado para llevar: Casco, Arnés");
    await expect(page.locator("#visLista .vis-row").first()).toContainText("Riesgo");
    await irA(page, "Control");
    await expect(page.locator("#pedidos .ped-row")).toHaveCount(2);
    await page.getByRole("button", { name: "Resuelto: Casco en la obra 2501" }).click();
    await expect(page.locator("#pedidos .ped-row")).toHaveCount(1);
    await page.locator("#altaPedido summary").click();
    await page.locator("#pdObra").selectOption("2415");
    await page.locator("#pdQue").selectOption("Botas");
    await page.fill("#pdDet", "Talla 43 para Sergi");
    await page.click("#pdAdd");
    await expect(page.locator("#pedidos")).toContainText("Botas");
    await irA(page, "Obras");
    await expect(tarjetaObra(page, "2415").locator(".oc-meta")).toContainText("Botas");
    await expect(tarjetaObra(page, "2501").locator(".oc-meta")).toContainText("Riesgo");
    await irA(page, "Semana");
    await expect(page.locator("#semPend")).toContainText("Petición pendiente: Arnés");
  });
});

test.describe("peticiones de los encargados", () => {
  test("una llamada se apunta desde la obra, se resuelve y sale en el parte", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Obras");
    await tarjetaObra(page, "2415").getByRole("button", { name: /Anotar petición/ }).click();
    await expect(page.getByRole("tab", { name: "Control" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#altaPedido")).toHaveAttribute("open", "");
    await expect(page.locator("#pdObra")).toHaveValue("2415");
    await expect(page.locator("#pdQuien")).toHaveValue("Jordi Sala");
    await page.locator("#pdQue").selectOption("Más personal");
    await page.fill("#pdDet", "Dos peones desde el lunes");
    await page.click("#pdAdd");
    await expect(page.locator("#pdHint")).toContainText("Dile cuándo lo tendrá");
    const fila = page.locator("#pedidos .ped-row", { hasText: "Más personal" });
    await expect(fila).toContainText("Dos peones desde el lunes");
    await expect(fila).toContainText("pide Jordi Sala");
    await irA(page, "Obras");
    await expect(tarjetaObra(page, "2415").locator(".oc-meta")).toContainText("Peticiones pendientes");
    await irA(page, "Semana");
    await expect(page.locator("#semPend")).toContainText("Petición pendiente: Más personal");
    await irA(page, "Control");
    await page.getByRole("button", { name: "Resuelto: Más personal en la obra 2415" }).click();
    await expect(page.locator("#pdHint")).toContainText("Avisa a Jordi Sala");
    await expect(page.locator("#pedidos")).toContainText("Nada pendiente");
    await page.addInitScript(() => {
      window.__compartido = [];
      navigator.canShare = (d) => !!(d && d.files);
      navigator.share = (d) => { window.__compartido.push(d.text); return Promise.resolve(); };
    });
    await page.reload();
    await irA(page, "Semana");
    await page.getByRole("button", { name: "Enviar a administración" }).click();
    await expect(page.locator("#semHint")).toContainText("Parte enviado");
    const [texto] = await page.evaluate(() => window.__compartido);
    expect(texto).toContain("Peticiones de los encargados: 1 petición, 1 resuelta (1 el mismo día)");
  });
});

test.describe("parte semanal", () => {
  test("tabla por obra y operario, con filtro por obra", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Semana");
    await expect(page.locator("#semTit")).toHaveText("Semana 40");
    await expect(page.locator("#swT")).toHaveText("4");
    await expect(page.locator("#swA")).toHaveText("3");
    const ahmed = page.locator("#semTabla tbody tr", { hasText: "Ahmed Khan" });
    await expect(ahmed.locator("td.t")).toHaveText("16");
    await expect(page.locator("#semTabla tbody tr", { hasText: "Rashid Ali" }).locator("td.x")).toHaveText("9");
    await expect(page.locator("#semTabla tfoot td.t")).toHaveText("41");
    await expect(page.locator("#semObras")).toContainText("Atención");
    await expect(page.locator("#semObras")).toContainText("Sin visita");
    await page.locator("#semObra").selectOption("2501");
    await expect(page.locator("#swH")).toHaveText("9");
    await expect(page.locator("#semTabla")).not.toContainText("Ahmed Khan");
    await page.click("#semPrev");
    await expect(page.locator("#semTit")).toHaveText("Semana 39");
    await expect(page.locator("#semTabla")).toContainText("Sin albaranes");
    await expect(page.locator("#semNext")).toBeEnabled();
    await page.click("#semNext");
    await expect(page.locator("#semNext")).toBeDisabled();
  });

  test("el Excel sale con operario, DNI, obra, cliente, dirección y horas por día", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Semana");
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#semCsv")]);
    expect(descarga.suggestedFilename()).toBe("parte-semanal-2026-S40.csv");
    const csv = readFileSync(await descarga.path(), "utf8");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const filas = csv.slice(1).split("\r\n").map((f) => f.split(";"));
    expect(filas[0]).toEqual(["Semana", "Operario", "DNI/NIE", "Categoría", "Código de obra", "Cliente", "Dirección", "Encargado",
      "Lun 28/09", "Mar 29/09", "Mié 30/09", "Jue 01/10", "Vie 02/10", "Sáb 03/10", "Dom 04/10", "Total horas", "Albaranes", "Observaciones"]);
    const ahmed = filas.find((f) => f[1] === "Ahmed Khan");
    expect(ahmed.slice(0, 11)).toEqual(["S40 28/09/2026", "Ahmed Khan", "X1234567L", "Oficial 1ª", "2415", "Promociones Valldaura SL",
      "Pg. de Valldaura 120 · Barcelona", "Karim Benali", "8", "8", ""]);
    expect(ahmed[15]).toBe("16");
    expect(ahmed[16]).toContain("004512");
    expect(ahmed[17]).toBe("sin firma");
    expect(filas.find((f) => f[1] === "Rashid Ali")[17]).toBe("Mar 9 h");
    expect(filas.at(-1)[1]).toBe("TOTAL");
    expect(filas.at(-1)[15]).toBe("41");
  });

  test("un nombre que empieza por = no se convierte en fórmula en Excel", async ({ page }) => {
    const d = datosReales();
    d.albaranes[0].lineas[0].n = "=HYPERLINK(\"x\")";
    await sembrarReales(page, d);
    await abrir(page);
    await irA(page, "Semana");
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#semCsv")]);
    const csv = readFileSync(await descarga.path(), "utf8");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  test("el PDF imprime solo el parte, con la tabla completa", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await page.evaluate(() => { window.print = () => {}; });
    await irA(page, "Semana");
    await page.click("#semPdf");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".shell")).toBeHidden();
    const informe = page.locator("#printHost .informe");
    await expect(informe).toBeVisible();
    await expect(informe).toContainText("Parte semanal de personal");
    await expect(informe).toContainText("Preparado por Marc Vidal");
    await expect(informe.locator("tbody tr").first()).toContainText("2415");
    await expect(informe).toContainText("Pendiente");
  });

  test("enviar a administración comparte el Excel desde el móvil", async ({ page }) => {
    await page.addInitScript(() => {
      window.__compartido = [];
      navigator.canShare = (d) => !!(d && d.files);
      navigator.share = (d) => {
        window.__compartido.push({ title: d.title, text: d.text, files: (d.files || []).map((f) => f.name) });
        return Promise.resolve();
      };
    });
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Semana");
    await page.getByRole("button", { name: "Enviar a administración" }).click();
    await expect(page.locator("#semHint")).toContainText("Parte enviado");
    const [envio] = await page.evaluate(() => window.__compartido);
    expect(envio.files).toEqual(["parte-semanal-2026-S40.csv"]);
    expect(envio.text).toContain("Semana 40");
    expect(envio.text).toContain("4 operarios · 41 h · 3 albaranes");
    expect(envio.text).toContain("Marc Vidal");
    await expect(page.locator("#semRango")).toContainText("enviada 30/09");
  });

  test("sin compartir, descarga el Excel y avisa de dónde poner administración", async ({ page }) => {
    await page.addInitScript(() => { navigator.canShare = undefined; });
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Semana");
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Enviar a administración" }).click()]);
    expect(descarga.suggestedFilename()).toBe("parte-semanal-2026-S40.csv");
    await expect(page.locator("#semHint")).toContainText("Ajustes");
  });
});

test.describe("tus datos a salvo", () => {
  test("copia de seguridad: descargar, borrar y restaurar", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Ajustes");
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#copiaBtn")]);
    const ruta = await descarga.path();
    const copia = JSON.parse(readFileSync(ruta, "utf8"));
    expect(copia.app).toBe("amra-control");
    expect(copia.datos.obras.map((o) => o.cod)).toEqual(["2415", "2501"]);
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Borrar todos mis datos de este móvil" }).click()]);
    await expect(page.getByRole("tab", { name: "Obras" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#koObras")).toHaveText("0");
    await irA(page, "Ajustes");
    await Promise.all([page.waitForEvent("load"), page.setInputFiles("#restaurarIn", ruta)]);
    await irA(page, "Obras");
    await expect(page.locator("#koObras")).toHaveText("2");
    await irA(page, "Albaranes");
    await expect(page.locator(".alb")).toHaveCount(3);
  });

  test("un archivo que no es una copia no toca nada", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    await irA(page, "Ajustes");
    await page.setInputFiles("#restaurarIn", { name: "otra.json", mimeType: "application/json", buffer: Buffer.from('{"hola":1}') });
    await expect(page.locator("#copiaHint")).toContainText("no es una copia");
    expect(await page.evaluate(() => OBRAS.length)).toBe(2);
  });

  test("datos corruptos no rompen la app", async ({ page }) => {
    const problemas = vigilar(page);
    await page.addInitScript((k) => {
      localStorage.setItem(k, JSON.stringify({ obras: [null, { cod: "" }, { cod: "9" }, { cod: "9" }], plantilla: [{ id: 1 }, { id: "x", n: "Ana", c: "Rara" }],
        albaranes: "no", visitas: [{ id: "v", fecha: "mal" }], pedidos: [{ que: "Casco" }], movs: 4, admin: 7 }));
    }, KEY_REAL);
    await abrir(page);
    for (const p of PANTALLAS) await irA(page, p);
    expect(problemas.filter((p) => !p.startsWith("externa"))).toEqual([]);
    expect(await page.evaluate(() => [OBRAS.length, PLANTILLA[0].c])).toEqual([1, "Peón ordinario"]);
  });
});

test.describe("calidad con datos reales", () => {
  test("ninguna pantalla desborda, con fichas abiertas", async ({ page }) => {
    await sembrarReales(page);
    await abrir(page);
    for (const p of PANTALLAS) {
      await irA(page, p);
      if (p === "Obras") {
        const obra = tarjetaObra(page, "2415");
        await obra.locator(".wrow summary").first().click();
        await obra.locator(".traer summary").click();
        await obra.locator(".oedit:not(.traer) summary").click();
      }
      await sinDesbordes(page, p);
    }
  });

  test("accesibilidad sin fallos graves (axe, WCAG 2.1 AA)", async ({ page }, info) => {
    test.skip(!["movil-390", "escritorio-1440"].includes(info.project.name), "basta con móvil y escritorio");
    await sembrarReales(page);
    await abrir(page);
    const graves = [];
    const revisar = async (donde) => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) {
        if (["serious", "critical"].includes(v.impact)) graves.push(`${donde}: ${v.id} (${v.nodes.length}) ${v.nodes[0].target}`);
      }
    };
    for (const p of PANTALLAS) {
      await irA(page, p);
      if (p === "Obras") {
        const obra = tarjetaObra(page, "2415");
        await obra.locator(".wrow summary").first().click();
        await obra.locator(".traer summary").click();
        await obra.locator(".oedit:not(.traer) summary").click();
        await page.locator("#altaObra summary").click();
      }
      if (p === "Visitas") await page.locator("#visFaltas label").first().click();
      await revisar(p);
    }
    await irA(page, "Albaranes");
    await page.locator(".alb").first().click();
    await page.locator(".sheet-in").evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
    await revisar("albarán abierto");
    expect(graves).toEqual([]);
  });

  test("los controles de obra se pulsan con guantes (44 px)", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("movil"), "solo móvil");
    await sembrarReales(page);
    await abrir(page);
    const pequenos = [];
    for (const p of ["Nuevo albarán", "Obras", "Visitas", "Control"]) {
      await irA(page, p);
      if (p === "Obras") await tarjetaObra(page, "2415").locator(".traer summary").click();
      pequenos.push(...(await page.evaluate(() =>
        [...document.querySelectorAll("section:not([hidden]) button, section:not([hidden]) summary, section:not([hidden]) .seg input, section:not([hidden]) .chips input, section:not([hidden]) .pick input, section:not([hidden]) a.btn")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 44 || r.width < 44)
          .map(({ el, r }) => `${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 30) || el.id}: ${Math.round(r.width)}×${Math.round(r.height)}`),
      )));
    }
    expect(pequenos).toEqual([]);
  });
});
