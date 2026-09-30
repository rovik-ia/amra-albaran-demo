// Utilidades compartidas por las pruebas.
import { expect } from "@playwright/test";

// Reloj fijo: miércoles 30 de septiembre de 2026, 10:00 en Madrid (semana 40: 28 sep – 4 oct).
export const HOY = new Date("2026-09-30T10:00:00+02:00");
export const KEY_DEMO = "rovik.albaranes.amra";
export const KEY_REAL = "rovik.amra.real";

export function vigilar(page) {
  const problemas = [];
  page.on("pageerror", (e) => problemas.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problemas.push(`console: ${m.text()}`);
  });
  page.on("request", (r) => {
    const { hostname, protocol } = new URL(r.url());
    if (protocol.startsWith("http") && hostname !== "127.0.0.1") problemas.push(`externa: ${r.url()}`);
  });
  return problemas;
}

export async function irA(page, nombre) {
  await page.getByRole("tab", { name: nombre, exact: true }).click();
}

// Nada se sale de la pantalla ni de su tarjeta (las tarjetas recortan, así que ese desborde no se vería).
export async function sinDesbordes(page, donde) {
  const exceso = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(exceso, `desborde en ${donde}`).toBeLessThanOrEqual(0);
  const fuera = await page.evaluate(() =>
    [...document.querySelectorAll(".card *, .kpis *, .ocard *")]
      .filter((el) => el.offsetParent !== null && !el.closest(".sr"))
      .filter((el) => {
        const caja = el.closest(".card, .kpis, .ocard").getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > caja.right + 1 || r.left < caja.left - 1);
      })
      .map((el) => el.id || el.className || el.tagName),
  );
  expect(fuera, `se sale de su tarjeta en ${donde}`).toEqual([]);
}

// Obra, plantilla, albaranes en papel y una visita: la semana 40 a medias.
export function datosReales({ inicio = "2026-09-28" } = {}) {
  const obras = [
    { cod: "2415", cli: "Promociones Valldaura SL", dir: "Pg. de Valldaura 120 · Barcelona", enc: "Karim Benali", jefe: "Jordi Sala", tel: "600111222", mapa: "" },
    { cod: "2501", cli: "Construccions Osona SA", dir: "C/ Nou 127 · Vic", enc: "Luis Romero", jefe: "Nuria Prat", tel: "", mapa: "" },
  ];
  const papel = (id, num, cod, fecha, lineas, { sinFirma = false } = {}) => ({
    id, num, tal: "papel", seq: parseInt(num, 10), tipo: "papel", fecha, obra: obras.find((o) => o.cod === cod),
    lineas, firmante: sinFirma ? "" : "Jordi Sala · jefe de obra", sinFirma, firma: "", foto: false,
    emitido: `${fecha}T16:00:00.000Z`, propio: true,
  });
  return {
    v: 2, emisor: "Amra Building", obras,
    plantilla: [
      { id: "a", n: "Ahmed Khan", c: "Oficial 1ª", obra: "2415", dni: "X1234567L", tel: "" },
      { id: "b", n: "José Moreno", c: "Oficial 2ª", obra: "2415", dni: "", tel: "" },
      { id: "c", n: "Sergi Ferrer", c: "Peón ordinario", obra: "2415", dni: "", tel: "" },
      { id: "d", n: "Rashid Ali", c: "Peón especialista", obra: "2501", dni: "Y7654321B", tel: "" },
    ],
    albaranes: [
      papel("p1", "004512", "2415", "2026-09-28", [{ n: "Ahmed Khan", c: "Oficial 1ª", h: 8 }, { n: "José Moreno", c: "Oficial 2ª", h: 8 }]),
      papel("p2", "004513", "2415", "2026-09-29", [{ n: "Ahmed Khan", c: "Oficial 1ª", h: 8 }, { n: "Sergi Ferrer", c: "Peón ordinario", h: 8 }], { sinFirma: true }),
      papel("p3", "000210", "2501", "2026-09-29", [{ n: "Rashid Ali", c: "Peón especialista", h: 9 }]),
    ],
    visitas: [
      { id: "v1", fecha: "2026-09-29", hora: "08:00", obra: "2415", con: "Jordi Sala", presentes: ["Ahmed Khan", "José Moreno"],
        estado: "atencion", temas: ["Falta personal"], nota: "Falta Sergi a primera hora.", oport: "Piden un oficial más.", paso: "", creado: "", faltas: [] },
    ],
    pedidos: [], movs: [], enviadas: {}, series: {}, tarifas: {},
    yo: "Marc Vidal", admin: { email: "", tel: "" }, serie: "obra", inicio,
  };
}

// Carga los datos una sola vez por pestaña: una recarga no los vuelve a pisar.
export async function sembrarReales(page, datos = datosReales()) {
  await page.addInitScript(
    ([k, d]) => {
      if (sessionStorage.getItem("sembrado")) return;
      localStorage.setItem(k, JSON.stringify(d));
      sessionStorage.setItem("sembrado", "1");
    },
    [KEY_REAL, datos],
  );
}
