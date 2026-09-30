# Albarán de horas — maqueta

Maqueta de producto de **ROVIK.IA**. **No es un sitio oficial de Amra Building** ni está
operado por ellos: es una propuesta comercial que se le presenta a la empresa.

Empresas cliente, plantilla y tarifas son datos de ejemplo. Los códigos de obra son los que
Amra Building publica en su propia web.

No recoge ni envía ningún dato: todo lo que se escribe se queda en el navegador del móvil.
No hace peticiones a terceros (las fuentes van incluidas) y funciona sin conexión tras la
primera visita.

## Qué enseña

| Pantalla | Qué demuestra |
| --- | --- |
| Nuevo albarán | Parte del día en obra: talonario numerado, obra, cuadrilla, horas y firma del cliente |
| Control | Horas pagadas en nómina sin albarán firmado, en euros, y huecos de numeración en los talonarios |
| Albaranes | Todo lo firmado; cada albarán se envía al cliente o se guarda en PDF |
| Cierre de mes | La base a facturar por cliente y obra, con cada línea respaldada por albaranes |
| Ajustes | Empresa, cliente de cada obra y precio por hora de cada categoría |

Los datos de ejemplo se generan para el mes en curso (o el anterior, los primeros días del
mes). El día de hoy aparece como jornada pagada sin albarán hasta que se firma el parte.

## Estructura

- `index.html`: toda la aplicación (HTML, CSS y un único script).
- `sw.js`: service worker. Red primero para la página, caché primero para fuentes e iconos.
  Sube `CACHE` cuando cambies fuentes, iconos o el manifiesto.
- `fonts/`: Poppins e IBM Plex Mono (licencia OFL, incluida).
- `scripts/csp.mjs`: recalcula la huella del script en la Content-Security-Policy.
  **Ejecútalo tras cualquier cambio en el script** (`npm run csp`); si no, el navegador lo bloquea.

## Verificación

```bash
npm install
npm run csp
CHROMIUM_PATH=/ruta/a/chromium npm test   # sin CHROMIUM_PATH usa el navegador de Playwright
```

La batería (`tests/demo.spec.mjs`, Playwright + axe) prueba con el reloj fijado el
30-09-2026 en móvil (375 y 390 px), tableta (768), portátil (1024) y escritorio (1440):
emisión completa, persistencia, datos corruptos, cambio de mes, cierre y tarifas, control de
huecos, accesibilidad WCAG 2.1 AA, zoom de iOS, objetivos táctiles de 44 px, teclado,
impresión, uso sin conexión y llegada de versiones nuevas.
