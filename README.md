# Control de obra · Amra Building

Herramienta de **ROVIK.IA** para llevar el control de obras, personal y albaranes de horas en papel.
Web estática que funciona como app en el móvil: sin servidor, sin cuentas y sin conexión una vez abierta.

**Los datos se guardan solo en el móvil que la usa.** No se envían a ningún sitio salvo cuando quien la
usa comparte el parte o un albarán. No hay peticiones a terceros (las fuentes van incluidas).

## Dos modos

| Dirección | Qué abre |
| --- | --- |
| `./` | **Tus datos.** Empieza vacía: das de alta tus obras y tu personal. Es lo que se instala en el móvil. |
| `./?demo` | **Demo** con datos de ejemplo, para enseñarla. Se guarda aparte y nunca toca tus datos. |

## Pantallas

| Pantalla | Para qué |
| --- | --- |
| Nuevo albarán | Pasar a limpio el albarán en papel: nº, obra, día, horas de cada operario, si trae firma y fecha del cliente, y foto |
| Presupuesto | Solo en tus datos. Preguntas para la reunión (las respuestas se copian como nota), coste de la hora desde el convenio y precio por m² de una cuadrilla, y ofertas por partidas con su total sin IVA, que se copian o se comparten. Los porcentajes y el rendimiento empiezan vacíos y la pantalla avisa de lo que falta |
| Obras | Cada obra con su cliente, dirección, encargado, jefe de obra, ubicación de Google Maps y su personal. Mover gente de obra |
| Visitas | Quién estaba en obra, cómo va (bien, atención, riesgo), temas, EPIs y material que faltan, oportunidades |
| Semana | Parte semanal por operario y día, con obra, cliente y dirección. Excel (CSV), PDF y envío a administración |
| Control | Visto en obra sin albarán, horas a quien no estaba, sin firma, sin foto, días sin albarán, obras sin visitar, EPIs por llevar y huecos de numeración |
| Albaranes | Todo lo registrado; cada uno se comparte, se guarda en PDF o se anula (queda marcado, deja de contar horas) |
| Ajustes | Tu nombre, contacto de administración, talonarios, copia de seguridad |
| `tarjeta.html` | Tarjeta de visita con el monograma de Amra y QR (WhatsApp o contacto). A4 de 10 con marcas de corte, o PDF de imprenta 85 × 55 mm con 3 mm de sangrado |

## Estructura

- `index.html`: la app (HTML, CSS y un único script).
- `tarjeta.html`: la tarjeta de visita. Usa `vendor/qrcode.js` (qrcode-generator 1.4.4, Kazuhiko Arase, licencia MIT).
- `sw.js`: service worker. Red primero para las páginas, caché primero para fuentes, iconos y la librería del QR.
  Sube `CACHE` cuando cambies cualquiera de ellos.
- `fonts/`: Poppins e IBM Plex Mono (licencia OFL, incluida).
- `scripts/csp.mjs`: recalcula la huella de los scripts en la Content-Security-Policy de las dos páginas.
  **Ejecútalo tras cualquier cambio en un script** (`npm run csp`); si no, el navegador lo bloquea.

Las fotos de los albaranes se guardan reducidas (1.400 px de lado como mucho) en IndexedDB del propio móvil.

## Verificación

```bash
npm install
npm run csp
CHROMIUM_PATH=/ruta/a/chromium npm test   # sin CHROMIUM_PATH usa el navegador de Playwright
```

La batería (`tests/`, Playwright + axe) prueba con el reloj fijado el 30-09-2026 en móvil (375 y 390 px),
tableta (768), portátil (1024) y escritorio (1440):

- `demo.spec.mjs`: la demo completa (emisión, control, cierre, persistencia, sin conexión, actualizaciones).
- `real.spec.mjs`: arranque vacío, alta de obras y personal (también pegando desde Excel), cambios de obra,
  Google Maps, albarán en papel con foto, números repetidos, anulación, cruce visitas–albaranes, EPIs,
  parte semanal (tabla, Excel, PDF, envío), copia de seguridad y datos corruptos.
- `tarjeta.spec.mjs`: lee los QR con un lector real (jsQR) y comprueba las medidas de los PDF.
- `presupuesto.spec.mjs`: coste de la hora y precio por m² contra cifras calculadas a mano, avisos de lo que falta,
  números mal escritos, partidas con el precio calculado, texto copiado de la oferta y de las notas, varias ofertas,
  recarga, datos rotos, teclado, 44 px y axe. Con `CAPTURAS=docs/capturas` guarda las capturas de móvil y escritorio.

Las cifras que trae el presupuesto por defecto (oficial de 1.ª 32.178,55 €/año, peón 27.351,74 €/año, 1.736 h) salen del convenio de
construcción de Barcelona 2026 (BOPB del 17-03-2026), según obrania.es. Hay que contrastarlo con el anexo del BOPB:
otra fuente daba 31.290,43 € para el oficial de 1.ª. Se cambia en `PRE_CALC_DEF` dentro de `index.html`.

En todas: accesibilidad WCAG 2.1 AA, objetivos táctiles de 44 px, sin zoom en iPhone y sin desbordes.
