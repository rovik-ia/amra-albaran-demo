# Informe técnico · Pantalla «Presupuesto» (04-10-2026)

Rama `claude/presupuesto-subcontrata`. Pensada para que Rafael la lleve en el móvil en la reunión con el dueño de
Amra Building: ir apuntando lo que le cuenta, calcular el precio de la hora y del m², y sacar una oferta por partidas.

## 1. Qué se ha construido

| Pieza | Qué hace |
| --- | --- |
| Pestaña «Presupuesto» | Solo en «tus datos» (`./`). En la demo (`./?demo`) no aparece |
| Preguntas para la reunión | 14 preguntas en 4 grupos y 4 cosas que pedir antes de irse. Contador de respondidas. «Copiar mis notas» las deja en texto para WhatsApp o Notas |
| Coste de la hora y precio por m² | Salario anual de convenio ÷ horas efectivas, más Seguridad Social de empresa y otros costes por hora. Precio = coste + gastos generales + beneficio, los dos sobre el coste directo. Cuadrilla (oficiales, peones, jornada, m²/día, material) → coste por día, coste y precio por m² |
| Avisos de lo que falta | Seguridad Social, gastos generales, beneficio y rendimiento empiezan **vacíos**: la pantalla dice qué falta en vez de suponerlo |
| Ofertas | Varias ofertas (máx. 40) con cliente, obra, fecha, validez, partidas (máx. 60), condiciones y total sin IVA. 8 partidas tipo de colocación cerámica y horas, o en blanco. «Usar precio calculado» pone el precio de m² o de hora del cálculo |
| Copiar y compartir | «Copiar la oferta» y «Copiar mis notas»; «Compartir» abre el menú del móvil cuando el navegador lo permite. Si el portapapeles falla, el texto aparece en pantalla para copiarlo a mano |
| Datos | Dentro de la misma clave de `localStorage` que el resto de la app (`d.pre`): entra en la copia de seguridad y en «Borrar todos mis datos». Validados al cargar (tipos, longitudes y límites) |

## 2. Verificación ejecutada

Google Chrome 154.0.8037.97 del sistema (`CHROMIUM_PATH`), reloj fijado el 30-09-2026, en 375, 390, 768, 1024 y 1440 px.

| Batería | Resultado |
| --- | --- |
| `presupuesto.spec.mjs` (nueva, 8 pruebas × 5 anchos) | **40 de 40** |
| Batería completa (demo, real, tarjeta y presupuesto) con 3 navegadores en paralelo | **303 pasadas, 2 fallidas, 40 omitidas** (las omitidas son pruebas solo de móvil o solo de escritorio, por diseño) |
| Las 2 fallidas, repetidas solas | **2 de 2**: era la prueba de accesibilidad de la demo, que agotó los 45 s por tener 3 navegadores a la vez en un MacBook de 8 GB. Sola tarda 14,4 s en esta rama y 13,8 s en `main` sin cambios, sin ninguna violación |

Qué cubre la batería nueva:

- El cálculo contra cifras hechas a mano (no con la fórmula de la app): 18,54 €/h de salario; con SS 32 %, 1,50 €/h de otros, GG 13 % y BI 6 %: 25,97 €/h de coste y 30,90 €/h de precio para el oficial; 22,30 € y 26,53 € para el peón; 593,86 €/día de cuadrilla; 17,85 €/m² de coste y 21,24 €/m² de precio.
- Avisos de lo que falta; un número mal escrito se marca con `aria-invalid` y no cuenta; «1.5» se escribe «1,50» al salir del campo.
- Oferta: 120 m² × 21,24 € = 2.548,80 €; 16 h × 30,90 € = 494,40 €; total 3.043,20 €. Una partida en «ud» no recibe precio inventado. Texto copiado comprobado línea a línea.
- Notas: contador, saltos de línea, casillas marcadas y sin marcar en el texto copiado.
- Varias ofertas, recarga, borrado, y datos rotos o de otra versión sin errores.
- Teclado: flechas entre pestañas, Tab hasta el primer campo.
- Sin desbordes, controles de 44 px en móvil, **axe WCAG 2.1 AA: 0 violaciones** en la pantalla, sin errores de consola y sin peticiones externas.

## 3. Rendimiento

No se ha pasado Lighthouse en esta entrega. El cambio no añade ficheros ni peticiones: `index.html` pasa de 197.921 a
230.363 bytes (+32 KB de HTML, CSS y JS en línea) y sigue funcionando sin conexión desde la caché.

## 4. Seguridad

Controles:

- CSP sin cambios de política; huella SHA-256 del script recalculada con `npm run csp`.
- Todo lo que escribe el usuario se inserta con `esc()` o como `value`; nada entra como HTML.
- Sin peticiones a terceros; los datos no salen del móvil salvo cuando el usuario copia o comparte.
- Validación al cargar: números finitos y acotados, textos recortados, unidades de una lista cerrada.

Hallazgos residuales:

| Nivel | Hallazgo | Acción |
| --- | --- | --- |
| MEDIO | Las notas de la reunión quedan en el móvil sin contraseña: quien tenga el móvil desbloqueado las lee | Bloqueo del móvil. Si la app se da a otras personas, ocultar la pestaña |
| BAJO | La app se publica bajo `toptendencias.es` (dominio de la cuenta de GitHub), ya conocido | Dominio propio de Rovik cuando haya |
| INFO | El repo no tiene CI ni Dependabot (hueco del estándar, anterior a este cambio) | Pendiente |

## 5. Errores encontrados y corregidos

1. La primera batería base se contaminó: seguía corriendo mientras se editaba `index.html` y algunas pruebas cargaron la página con la huella de la CSP sin actualizar. Se descartó y se repitió completa sobre el código terminado.
2. La prueba del cálculo abría y volvía a cerrar el desplegable (dos clics); se cambió por «abrir solo si está cerrado».
3. En el móvil, el contador «0 de 14 con respuesta» partía el título en dos líneas: ahora dice «0 de 14».
4. Los títulos de grupo («Cuadrilla», «Coste de la hora») se confundían con las etiquetas de los campos: ahora van en turquesa y con más aire.

## 6. Contenido que Rafael debe confirmar

- **Salario de convenio por defecto**: 32.178,55 € (oficial de 1.ª) y 27.351,74 € (peón), 1.736 h. Sale de obrania.es citando el BOPB del 17-03-2026; otra fuente daba 31.290,43 €. Contrastar con el anexo del BOPB.
- **Inversión del sujeto pasivo** (factura sin IVA entre empresas de construcción): confirmarlo con la gestoría de Amra.
- **Condiciones tipo** de la oferta: son un punto de partida para editar, no un modelo jurídico.
- **Referencias de gastos generales (13–17 %) y beneficio (6 %)**: son las de la contratación pública; en privado se negocian.

Capturas: `docs/capturas/presupuesto-movil-390.png` y `docs/capturas/presupuesto-escritorio-1440.png`, con datos de ejemplo.
