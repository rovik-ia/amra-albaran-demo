import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Reloj fijo: miércoles 30 de septiembre de 2026, 10:00 en Madrid.
const HOY = new Date("2026-09-30T10:00:00+02:00");
const KEY = "rovik.albaranes.amra";
const PANTALLAS = ["Nuevo albarán", "Control", "Albaranes", "Cierre de mes", "Ajustes"];

function vigilar(page) {
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

async function abrir(page, fecha = HOY) {
  await page.clock.setFixedTime(fecha);
  await page.goto("./");
  await expect(page.locator("#s-nuevo")).toBeVisible();
}

async function irA(page, nombre) {
  await page.getByRole("tab", { name: nombre }).click();
}

const euros = (texto) => Number(texto.replace(/[^\d,-]/g, "").replace(",", "."));

async function firmar(page) {
  const pad = page.locator("#pad");
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 30, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 18, y + Math.sin(i) * 25);
  await page.mouse.up();
}

async function marcarTrabajador(page, nombre) {
  await page.getByRole("button", { name: `Incluir a ${nombre}` }).click();
}

async function emitir(page, { talonario = "T-01", fecha, trabajadores, firmante = "Laia Soler · jefa de obra" }) {
  await irA(page, "Nuevo albarán");
  await page.locator("#talSel").selectOption(talonario);
  if (fecha) await page.locator("#fecha").fill(fecha);
  for (const nombre of trabajadores) await marcarTrabajador(page, nombre);
  await firmar(page);
  await page.locator("#firmante").fill(firmante);
  await page.getByRole("button", { name: "Emitir albarán" }).click();
  await expect(page.locator("#sheet")).toBeVisible();
}

test.describe("carga y calidad base", () => {
  test("carga sin errores ni peticiones a terceros", async ({ page }) => {
    const problemas = vigilar(page);
    await abrir(page);
    for (const p of PANTALLAS) await irA(page, p);
    await page.waitForLoadState("networkidle");
    expect(problemas).toEqual([]);
  });

  test("ninguna pantalla desborda en horizontal", async ({ page }) => {
    await abrir(page);
    for (const p of PANTALLAS) {
      await irA(page, p);
      const exceso = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(exceso, `desborde en ${p}`).toBeLessThanOrEqual(0);
      // nada se sale de su tarjeta (las tarjetas recortan, así que el desborde no se ve en la página)
      const fuera = await page.evaluate(() =>
        [...document.querySelectorAll(".card *, .kpis *")]
          .filter((el) => el.offsetParent !== null)
          .filter((el) => {
            const caja = el.closest(".card, .kpis").getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > caja.right + 1 || r.left < caja.left - 1);
          })
          .map((el) => el.id || el.className || el.tagName),
      );
      expect(fuera, `se sale de su tarjeta en ${p}`).toEqual([]);
    }
  });

  test("accesibilidad sin fallos graves (axe, WCAG 2.1 AA)", async ({ page }, info) => {
    test.skip(!["movil-390", "escritorio-1440"].includes(info.project.name), "basta con móvil y escritorio");
    await abrir(page);
    const graves = [];
    const revisar = async (donde) => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) {
        if (["serious", "critical"].includes(v.impact)) graves.push(`${donde}: ${v.id} (${v.nodes.length})`);
      }
    };
    for (const p of PANTALLAS) {
      await irA(page, p);
      await revisar(p);
    }
    await irA(page, "Albaranes");
    await page.locator(".alb").first().click();
    // se mide con la hoja ya asentada, no a mitad de su animación de entrada
    await page.locator(".sheet-in").evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
    await revisar("albarán abierto");
    expect(graves).toEqual([]);
  });
});

test.describe("uso en obra (móvil)", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(!info.project.name.startsWith("movil"), "solo móvil");
  });

  test("los campos no hacen zoom en iPhone (texto de 16 px o más)", async ({ page }) => {
    await abrir(page);
    const pequenos = [];
    for (const p of PANTALLAS) {
      await irA(page, p);
      pequenos.push(
        ...(await page.evaluate(() =>
          [...document.querySelectorAll("input, select, textarea")]
            .filter((el) => el.offsetParent !== null && parseFloat(getComputedStyle(el).fontSize) < 16)
            .map((el) => `${el.id || el.className}: ${getComputedStyle(el).fontSize}`),
        )),
      );
    }
    expect(pequenos).toEqual([]);
  });

  test("los controles del parte se pueden pulsar con guantes (44 px)", async ({ page }) => {
    await abrir(page);
    const pequenos = await page.evaluate(() =>
      [...document.querySelectorAll("nav.tabs button, #s-nuevo button, #s-nuevo select, #s-nuevo input")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.height < 44 || r.width < 44)
        .map(({ el, r }) => `${el.getAttribute("aria-label") || el.textContent.trim() || el.id}: ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(pequenos).toEqual([]);
  });
});

test.describe("parte del día", () => {
  test("el botón dice qué falta hasta que se puede emitir", async ({ page }) => {
    await abrir(page);
    const aviso = page.locator("#emitirHint");
    const boton = page.getByRole("button", { name: "Emitir albarán" });
    await expect(boton).toBeDisabled();
    await expect(aviso).toContainText("firma");
    await marcarTrabajador(page, "A. Khan Mahmood");
    await firmar(page);
    await expect(boton).toBeDisabled();
    await expect(aviso).toContainText("nombre");
    await page.locator("#firmante").fill("Laia Soler");
    await expect(boton).toBeEnabled();
  });

  test("emite un albarán numerado, con código y en la lista", async ({ page }) => {
    await abrir(page);
    await page.locator("#talSel").selectOption("T-02");
    const siguiente = (await page.locator("#talNum").textContent()).trim();
    await emitir(page, { talonario: "T-02", trabajadores: ["M. Iqbal Rashid", "R. Ali Hussain"] });
    const papel = page.locator("#paperHost .paper");
    await expect(papel.locator(".folio .num")).toHaveText(siguiente);
    await expect(papel.locator("tfoot")).toContainText("16,0 h");
    await expect(papel.locator(".vcode")).toHaveText(/^[0-9A-Z]{7}$/);
    await expect(papel).toContainText("Laia Soler");
    await page.keyboard.press("Escape");
    await expect(page.locator("#sheet")).toBeHidden();
    const num = Number(siguiente.slice(-4));
    await expect(page.locator("#talNum")).toHaveText(`T-02·${String(num + 1).padStart(4, "0")}`);
    await irA(page, "Albaranes");
    await expect(page.locator(".alb").first()).toContainText(siguiente);
  });

  test("no deja fechar un parte en el futuro", async ({ page }) => {
    await abrir(page);
    await expect(page.locator("#fecha")).toHaveAttribute("max", "2026-09-30");
  });

  test("avisa si un trabajador ya tiene horas firmadas ese día", async ({ page }) => {
    await abrir(page);
    await emitir(page, { trabajadores: ["A. Khan Mahmood"] });
    await page.keyboard.press("Escape");
    await expect(page.locator(".worker", { hasText: "A. Khan Mahmood" })).toContainText(/ya tiene .* firmadas/i);
  });

  test("la firma se guarda ligera (menos de 15 KB)", async ({ page }) => {
    await abrir(page);
    await emitir(page, { trabajadores: ["S. Ferrer Cano"] });
    const bytes = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).albaranes[0].firma.length, KEY);
    expect(bytes).toBeLessThan(15_000);
  });
});

test.describe("control y cierre", () => {
  test("el mes de los datos se nombra y hoy cuenta como jornada pendiente", async ({ page }) => {
    await abrir(page);
    await irA(page, "Control");
    await expect(page.locator(".alarm .k")).toContainText("septiembre 2026");
    await expect(page.locator("#huecos")).toContainText("30/09");
  });

  test("firmar una jornada pendiente reduce lo no facturado en su importe", async ({ page }) => {
    await abrir(page);
    await irA(page, "Control");
    const antes = euros(await page.locator("#fugaE").textContent());
    const hueco = page.locator(".hueco").first();
    const nombre = (await hueco.locator(".w").textContent()).trim();
    const dia = (await hueco.locator(".m").textContent()).match(/(\d{2})\/(\d{2})/);
    const importe = euros(await hueco.locator(".e b").textContent());
    const talonario = await page.evaluate((n) => {
      const w = PLANTILLA.find((x) => x.n === n);
      return TALONARIOS.find((t) => t.obra === w.obra).id;
    }, nombre);
    await emitir(page, { talonario, fecha: `2026-${dia[2]}-${dia[1]}`, trabajadores: [nombre] });
    await page.keyboard.press("Escape");
    await irA(page, "Control");
    const despues = euros(await page.locator("#fugaE").textContent());
    expect(Math.abs(antes - despues - importe)).toBeLessThanOrEqual(1);
  });

  test("el cierre suma horas por tarifa y se recalcula al cambiarla", async ({ page }) => {
    await abrir(page);
    const esperado = () =>
      page.evaluate(() =>
        state.albaranes
          .filter((a) => a.fecha.startsWith(state.mes))
          .reduce((s, a) => s + a.lineas.reduce((t, l) => t + l.h * state.tarifas[l.c], 0), 0),
      );
    await irA(page, "Cierre de mes");
    expect(euros(await page.locator("#kE").textContent())).toBeCloseTo(Math.round(await esperado()), 0);
    await irA(page, "Ajustes");
    await page.getByLabel("Oficial 1ª").fill("31,50");
    await page.getByLabel("Oficial 1ª").press("Tab");
    await irA(page, "Cierre de mes");
    expect(euros(await page.locator("#kE").textContent())).toBeCloseTo(Math.round(await esperado()), 0);
  });

  test("la lista muestra todos los albaranes", async ({ page }) => {
    await abrir(page);
    await irA(page, "Albaranes");
    const total = await page.evaluate(() => state.albaranes.length);
    await expect(page.locator(".alb")).toHaveCount(total);
  });

  test("detecta el talón que falta en la numeración", async ({ page }) => {
    await abrir(page);
    await irA(page, "Control");
    await expect(page.locator(".tal-row", { hasText: "T-02" }).locator(".missing")).toContainText("falta");
  });
});

test.describe("datos y persistencia", () => {
  test("los albaranes y los clientes de cada obra sobreviven a recargar", async ({ page }) => {
    await abrir(page);
    await irA(page, "Ajustes");
    await page.getByLabel("Cliente de la obra 2415").fill("Promociones Ejemplo SL");
    await page.getByLabel("Cliente de la obra 2415").press("Tab");
    await emitir(page, { trabajadores: ["J. Moreno Lillo"] });
    const folio = (await page.locator("#paperHost .folio .num").textContent()).trim();
    await page.reload();
    await expect(page.locator(".obra", { hasText: "2415" })).toContainText("Promociones Ejemplo SL");
    await irA(page, "Albaranes");
    await expect(page.locator(".alb").first()).toContainText(folio);
    await expect(page.locator(".alb").first()).toContainText("Promociones Ejemplo SL");
  });

  test("reiniciar la demo devuelve los valores de fábrica", async ({ page }) => {
    await abrir(page);
    await irA(page, "Ajustes");
    await page.getByLabel("Cliente de la obra 2415").fill("Otro cliente");
    await page.getByLabel("Cliente de la obra 2415").press("Tab");
    await page.getByRole("button", { name: "Reiniciar la demo" }).click();
    await irA(page, "Ajustes");
    await expect(page.getByLabel("Cliente de la obra 2415")).not.toHaveValue("Otro cliente");
  });

  test("datos guardados corruptos no rompen la app", async ({ page }) => {
    const problemas = vigilar(page);
    await page.addInitScript((k) => {
      localStorage.setItem(k, JSON.stringify({ albaranes: [{ num: "X" }, null, 7], jornadas: "roto", series: 3 }));
    }, KEY);
    await abrir(page);
    for (const p of PANTALLAS) await irA(page, p);
    expect(problemas.filter((p) => !p.startsWith("externa"))).toEqual([]);
  });

  test("al volver otro día del mes regenera los datos hasta hoy", async ({ page }) => {
    await abrir(page, new Date("2026-09-22T10:00:00+02:00"));
    await page.clock.setFixedTime(HOY);
    await page.reload();
    const ultimo = await page.evaluate(() => state.jornadas.map((j) => j.fecha).sort().at(-1));
    expect(ultimo).toBe("2026-09-30");
  });

  test("a primeros de mes trabaja sobre el mes anterior de forma coherente", async ({ page }) => {
    await abrir(page, new Date("2026-10-01T10:00:00+02:00"));
    await irA(page, "Control");
    await expect(page.locator(".alarm .k")).toContainText("septiembre 2026");
    await irA(page, "Nuevo albarán");
    await expect(page.locator("#fecha")).toHaveValue("2026-09-30");
  });
});

test.describe("albarán y navegación", () => {
  test("las pestañas se recorren con las flechas del teclado", async ({ page }) => {
    await abrir(page);
    await page.getByRole("tab", { name: "Nuevo albarán" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Control" })).toBeFocused();
    await expect(page.getByRole("tab", { name: "Control" })).toHaveAttribute("aria-selected", "true");
  });

  test("el albarán se cierra con Escape y devuelve el foco", async ({ page }) => {
    await abrir(page);
    await irA(page, "Albaranes");
    const primero = page.locator(".alb").first();
    await primero.click();
    await expect(page.locator("#sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#sheet")).toBeHidden();
    await expect(primero).toBeFocused();
  });

  test("al imprimir solo sale el albarán", async ({ page }) => {
    await abrir(page);
    await irA(page, "Albaranes");
    await page.locator(".alb").first().click();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".shell")).toBeHidden();
    await expect(page.locator("#paperHost .paper")).toBeVisible();
  });

  test("el albarán se puede enviar o guardar en PDF", async ({ page }) => {
    await abrir(page);
    await irA(page, "Albaranes");
    await page.locator(".alb").first().click();
    await expect(page.getByRole("button", { name: /Enviar/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /PDF|Imprimir/ })).toBeVisible();
  });

  test("el código de verificación cambia si se toca una hora", async ({ page }) => {
    await abrir(page);
    const [a, b] = await page.evaluate(() => {
      const alb = JSON.parse(JSON.stringify(state.albaranes[0]));
      const antes = verifCode(alb);
      alb.lineas[0].h += 0.5;
      return [antes, verifCode(alb)];
    });
    expect(a).not.toBe(b);
  });
});

test.describe("sin conexión y actualizaciones", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "movil-390", "el service worker se prueba una vez");
  });

  test("abre sin conexión después de la primera visita", async ({ page, context }) => {
    await abrir(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#s-nuevo")).toBeVisible();
    await expect(page.locator(".obra").first()).toBeVisible();
  });

  test("una versión nueva llega a quien ya la tenía instalada", async ({ page, request }) => {
    await abrir(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await request.get("/__marker?m=v-nueva");
    try {
      await page.reload();
      await expect(page.locator('meta[name="test-marker"]')).toHaveAttribute("content", "v-nueva");
    } finally {
      await request.get("/__marker?m=");
    }
  });
});
