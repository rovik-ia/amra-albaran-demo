# Control de obra · Amra Building

Herramienta de **ROVIK.IA** para llevar el control de obras, personal y albaranes de horas en papel.
Web estática que funciona como app en el móvil: sin servidor, sin cuentas y sin conexión una vez abierta.

**Los datos se guardan solo en el móvil que la usa.** No se envían a ningún sitio salvo cuando quien la
usa comparte el parte o un albarán. No hay peticiones a terceros (las fuentes van incluidas).

## Dos modos

| Dirección | Qué abre |
| --- | --- |
| `./` | **Tus datos.** Empieza vacía: das de alta tus obras y tu personal. Es lo que se instala en el móvil. |
| `./#obras=[…]` | **Enlace privado** que carga obras (código, dirección, Maps) en «tus datos». Lo que va tras `#` no llega nunca al servidor, así que las obras reales no quedan en la web ni en el repositorio. Solo añade las que faltan |
| `./?demo` | **Demo** con datos de ejemplo, para enseñarla. Se guarda aparte y nunca toca tus datos. |

## Pantallas

| Pantalla | Para qué |
| --- | --- |
| Mediciones | **La primera pantalla.** Lo hecho en cada obra semana a semana (lunes a domingo, cortadas en el mes). Se elige el trabajo de una lista con su unidad (m³ solo el vertido de hormigón, todo lo demás m²) y su criterio de medición; se escribe el total o se mide por paños, y se restan puertas, ventanas y huecos **según el criterio de ese trabajo** (CYPE, ver `docs/informe-mediciones.md`). Parte semanal en PDF para el jefe (se comparte por WhatsApp desde el móvil) y certificación del mes en Excel, PDF o texto. Arriba, el **panel de obras**: se toca la obra, luego el trabajo, y solo queda poner la cantidad |
| Nuevo albarán | Pasar a limpio el albarán en papel: nº, obra, día, horas de cada operario, si trae firma y fecha del cliente, y foto |
| Presupuesto | Solo en tus datos. Preguntas para la reunión (las respuestas se copian como nota), coste de la hora desde el convenio y precio por m² de una cuadrilla, y ofertas por partidas con su total sin IVA, que se copian, se comparten o se descargan en Excel. Las partidas se traen del **BC3 de Presto** (o pegando filas de Presto o Excel): se leen en el móvil, se marcan solas las de cerámica y guardan la cantidad y el precio del proyecto como referencia. Los porcentajes y el rendimiento empiezan vacíos y la pantalla avisa de lo que falta |
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
- `mediciones.spec.mjs` (reloj el 08-10-2026, obras de prueba inventadas): enlace privado de obras, panel, semanas del mes, paños, puertas y ventanas con el criterio de
  cada trabajo (cifras calculadas a mano), m³ del vertido, corregir y borrar, datos rotos, Excel y resumen línea a línea,
  parte semanal en PDF (estructura del PDF comprobada: tabla xref, longitudes de los streams, varias páginas) y compartirlo,
  certificación en PDF, desbordes, axe, 44 px y teclado. Con `CAPTURAS=docs/capturas` guarda capturas y los PDF de muestra.
- `presupuesto.spec.mjs`: coste de la hora y precio por m² contra cifras calculadas a mano, avisos de lo que falta,
  números mal escritos, partidas con el precio calculado, texto copiado de la oferta y de las notas, varias ofertas,
  recarga, datos rotos, teclado, 44 px y axe. Con `CAPTURAS=docs/capturas` guarda las capturas de móvil y escritorio.
  Importación: BC3 en Windows (ANSI), DOS (850) y UTF-8 declarado como ANSI (`tests/fixtures/`, escritos a mano según la
  especificación FIEBDC-3/2020), capítulos anidados con etiqueta, factor × rendimiento, descompuestos y porcentajes que no
  entran, cerámica de albañilería que no se marca, filas pegadas de Presto con cabecera y capítulos, y el Excel descargado.

Las cifras que trae el presupuesto por defecto (oficial de 1.ª 32.178,55 €/año, peón 27.351,74 €/año, 1.736 h) salen del convenio de
construcción de Barcelona 2026 (BOPB del 17-03-2026), según obrania.es. Hay que contrastarlo con el anexo del BOPB:
otra fuente daba 31.290,43 € para el oficial de 1.ª. Se cambia en `PRE_CALC_DEF` dentro de `index.html`.

### Lector de BC3 (FIEBDC-3)

`leeBC3()` en `index.html`, sin librerías. Registros `~C` (conceptos; `#` capítulo, `##` raíz), `~D` (descomposición: la
cantidad de una partida en su capítulo es factor × rendimiento; se lee el campo 3 si existe, si no el 2) y `~M` (mismo total
y la etiqueta, p. ej. «2.1.1»). No baja a los descompuestos de las partidas (mano de obra, materiales) ni cuenta los
porcentajes. El juego de caracteres declarado no siempre es el real: se prueba UTF-8 y luego el declarado y su alternativo
(Windows-1252 o DOS 850/437, tablas generadas con los códecs de Python), y gana el que da texto en castellano legible.
Probado además, fuera del repo, con seis BC3 públicos (Presto 8.8, Presto 22, IFC2BC3, pyCost): sin errores.

En todas: accesibilidad WCAG 2.1 AA, objetivos táctiles de 44 px, sin zoom en iPhone y sin desbordes.
