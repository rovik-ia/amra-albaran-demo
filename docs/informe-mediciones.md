# Informe técnico · Pantalla «Mediciones»

Entrega del 08-10-2026. Rama `claude/mediciones-semanales`.

## 1. Para qué es

Certificar el trabajo de los operarios: lo que se ha hecho en cada obra, semana a semana, para que Rafael lo apunte al medir en la
obra y su jefe lo reciba en un PDF al final de la semana. Es ahora la primera pestaña y la pantalla con la que se abre la app.

| Pieza | Qué hace |
| --- | --- |
| Panel de obras | Lo primero que se ve: una tarjeta por obra con lo medido esta semana y este mes. Se toca la obra, aparecen los trabajos por oficio (arriba, lo último hecho en esa obra), se toca el trabajo y el cursor queda en la cantidad |
| Obras por enlace privado | Las 5 obras reales (BLANES, PALAMOS, VILABLAREIX, GIRONA y AMETLLA, con el Maps que dio Rafael) **no van en el código**: la app y el repositorio son públicos. Se cargan con un enlace `…/#obras=[…]`; lo que va tras `#` no sale del móvil. Solo añade las que faltan y no pisa ninguna |
| Mes y semanas | Semanas de lunes a domingo, cortadas en el día 1 y en el último del mes, para que cada medición cuente en un solo mes |
| Anotar | Obra, día (nunca futuro), trabajo de la lista, cantidad (o paños), zona, operarios (los de la obra o escritos), precio opcional y nota. Recuerda el último trabajo, precio y cuadrilla de cada obra |
| Trabajos | Lista por oficios con su unidad: **m³ solo el vertido de hormigón; todo lo demás m²** (indicación de Rafael). Lo que no está va en «Otro trabajo» y queda en la lista para la próxima vez |
| Puertas y ventanas | «Restar puerta», «Restar ventana», «Otro hueco»: cuántas, ancho y alto. Se restan **según el criterio de medición del trabajo** (tabla de abajo). La app recuerda la medida de la última puerta y ventana de cada obra |
| Parte semanal | PDF A4 hecho en el propio móvil, sin librerías ni conexión: cifras de la semana, resumen por obra (incluidas las que no tienen medición), detalle con día, trabajo, zona, operarios, cómo se midió y notas, firma y pie con número de página. «Enviar PDF por WhatsApp» abre el menú de compartir del móvil con el PDF adjunto |
| Certificación del mes | Excel (CSV), PDF por impresión y resumen en texto, de todas las obras o de una |

## 2. Criterios de medición (fuente)

Leídos ficha por ficha en el **Generador de precios de CYPE** el 08-10-2026. Es una base de referencia, no una norma: **si el
contrato o el pliego de la obra dicen otra cosa, manda el contrato.** Cada criterio sale en el formulario al elegir el trabajo.

| Trabajo | Ud | Huecos | Ficha |
| --- | --- | --- | --- |
| Guarnecido y enlucido, yeso proyectado, enlucido | m² | Hasta 4 m² no se restan; de los mayores, solo el exceso sobre 4 m². Altura de suelo a techo, a cinta corrida. Armarios empotrados no se descuentan | [RPG010](https://generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Conglomerados_tradicionales/Guarnecidos_y_enlucidos/Guarnecido_de_yeso.html), [RPG011](https://generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Conglomerados_tradicionales/Guarnecidos_y_enlucidos/Enlucido_de_yeso.html), [RPG015](https://generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Conglomerados_tradicionales/Guarnecidos_y_enlucidos/Yeso_proyectado.html) |
| Tabique y trasdosado de pladur | m² | La ficha remite a la UNE 92305 (de pago, **no consultada**). La app los resta enteros y lo avisa | [FBY010](https://generadordeprecios.info/obra_nueva/Fachadas_y_particiones/FB_Tabiqueria_de_entramado_autopo/De_placas_de_yeso_laminado/Tabique_de_placas_de_yeso_laminado.html), [RRY001](https://generadordeprecios.info/rehabilitacion/Revestimientos_y_trasdosados/Trasdosados/De_placas_de_yeso_laminado/RRY001_Trasdosado_directo_de_placas_de_yes.html) |
| Techo de pladur | m² | Entre paredes; no se descuentan huecos para instalaciones | [RTC015](https://generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Falsos_techos_en_interiores/RTC_Continuos__de_placas_de_yeso_l/RTC015_Falso_techo_continuo_de_placas_de_y.html) |
| Alicatado (rajola, gres) | m² | Se restan los de más de 3 m². Nada por roturas ni recortes | [RAG011](http://schluter-systems.generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Alicatados/De_baldosas_ceramicas/RAG011_Alicatado_sobre_superficie_soporte_.html) |
| Solado (rajola, gres) | m² | Superficie útil realmente solada | [RSG010](http://www.generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Pavimentos/De_baldosas_ceramicas/RSG010_Solado_de_baldosas_ceramicas_coloca.html) |
| Bloque de hormigón, tabique de ladrillo | m² | Se restan los de más de 3 m²; en los demás va incluida la cara interior del hueco | [FFQ020](https://generadordeprecios.info/obra_nueva/Fachadas_y_particiones/Fabrica_no_estructural/Hoja_para_revestir_en_particion/FFQ020_Hoja_de_particion_interior__de_fabr.html), [FFQ010](https://generadordeprecios.info/obra_nueva/Fachadas_y_particiones/Fabrica_no_estructural/Hoja_para_revestir_en_particion/FFQ010_Hoja_de_particion_interior__de_fabr.html) |
| Fachada de ladrillo para revestir | m² | Se restan los de más de 4 m² | [FFZ010](https://generadordeprecios.info/obra_nueva/Fachadas_y_particiones/Fabrica_no_estructural/FFZ_Hoja_exterior_para_revestir_en/FFZ010_Hoja_exterior_de_fachada_de_dos_hoj.html) |
| Enfoscado | m² | Hasta 4 m² no se restan; de los mayores, el exceso | [RPE010](https://generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Conglomerados_tradicionales/Enfoscados/RPE010_Enfoscado_de_cemento_sobre_parament.html) |
| Mortero monocapa | m² | Se restan los de más de 3 m² y se suma el desarrollo de las mochetas (se añade como paño) | [RQO010](https://generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Sistemas_monocapa_industriales/Morteros_monocapa/Mortero_monocapa.html) |
| Pintura plástica sobre yeso | m² | «Con el mismo criterio que el soporte base»: el del yeso | [RIP030](https://generadordeprecios.info/obra_nueva/Revestimientos_y_trasdosados/Pinturas_en_paramentos_interiores/Plasticas/RIP030_Pintura_plastica_sobre_paramento_in.html) |
| SATE | m² | Se restan los de más de 1 m² y se suma su cara interior (jambas y dintel): (2 × alto + ancho) × fondo | [FSM010](https://generadordeprecios.info/obra_nueva/Fachadas_y_particiones/Fachadas_ETICS/FSM_Revestimiento_continuo_mineral/FSM010_Sistema_ETICS_de_aislamiento_termic.html) |
| Vertido en cimentación | m³ | Volumen teórico sobre las secciones de la excavación; los excesos no autorizados no se pagan | [CSL010](https://generadordeprecios.info/obra_nueva/Cimentaciones/Superficiales/Losas/Losa_de_cimentacion.html), CSZ010 |
| Vertido en muros | m³ | Volumen teórico; se restan los huecos de más de 2 m² | [EHM010](https://www.generadordeprecios.info/obra_nueva/Estructuras/Hormigon_armado/Muros/Muro_de_hormigon.html) |
| Vertido en pilares | m³ | Volumen realmente ejecutado | [EHS010](https://carm.generadordeprecios.info/obra_nueva/Estructuras/Hormigon_armado/Pilares/EHS010_Pilar_rectangular_o_cuadrado_de_hor.html) |
| Vertido en forjado o losa | m³ | **CYPE no da criterio para el vertido solo**: la losa completa la mide en m² y resta huecos de más de 6 m² ([EHL010](https://www.generadordeprecios.info/obra_nueva/Estructuras/Hormigon_armado/Losas_macizas/Losa_maciza.html)). La app resta los huecos enteros y lo avisa | — |

Se quitaron de la lista los trabajos cuyo criterio no se pudo comprobar en una ficha (falso techo registrable, mosaico, cara vista,
recrecido, impermeabilización, encofrado, rodapié, peldaños). Se pueden anotar con «Otro trabajo» (resta los huecos enteros).

Comprobación con cifras hechas a mano (150 m² con 3 ventanas de 1,20 × 1,10 y 1 puerta de 2,50 × 2,10):

| Trabajo | Cálculo | A certificar |
| --- | --- | --- |
| Yeso | Ventanas de 1,32 m² no se restan; de la puerta (5,25 m²) solo 1,25 | 148,75 m² |
| Alicatado, bloque | Ventanas no; puerta entera | 144,75 m² |
| Pladur | Todo: 3,96 + 5,25 | 140,79 m² |
| SATE (fondo 0,20) | Todo, más jambas de las ventanas: (2 × 1,10 + 1,20) × 0,20 × 3 = 2,04 | 142,83 m² |
| Muro, 2 × (10 × 0,30 × 2,50) = 15 m³ | Hueco de 2 m² no; hueco de 3 m² × 0,30 = 0,90 | 14,10 m³ |

## 3. Verificación

Ver la sección 5 (resultados de la batería) al final de este informe.

## 4. Errores encontrados y corregidos durante el trabajo

1. **Choque de nombres:** la pantalla Presupuesto ya tenía una variable global `UNIDADES` con 9 unidades; la de Mediciones la
   redefinía y, por orden de ejecución, ganaba la de Presupuesto. Las pruebas pasaban por casualidad. Renombrada a `UDS_MED`.
2. **Clase CSS repetida:** `.hueco` ya existía (huecos de numeración de talonarios) y descuadraba las filas de puertas y ventanas en el
   móvil. Se vio en la captura a 390 px, no en las pruebas. Renombrada a `.md-hueco`.
3. **Contraste:** las semanas futuras se atenuaban con `opacity` y axe dio fallo de contraste. Ahora usan el color terciario.
4. **PDF:** la unidad «m²» se quedaba sola en otra línea del resumen; ahora va pegada al número con espacio irrompible.

## 5. Resultados de la batería

Google Chrome del sistema (`CHROMIUM_PATH`), en 375, 390, 768, 1024 y 1440 px, 3 navegadores en paralelo, con `caffeinate` para que
el Mac no se duerma a mitad (la primera tanda se colgó horas por eso).

| Batería | Resultado |
| --- | --- |
| Completa (demo, real, tarjeta, presupuesto y mediciones) | **472 pasadas, 2 fallidas, 46 omitidas** (las omitidas son solo-móvil o solo-escritorio, por diseño) |
| Las 2 fallidas, solas | **2 de 2.** Era la prueba de accesibilidad de la demo, que con 3 navegadores a la vez superaba los 45 s (sola tarda ~24 s). Se le ha dado 120 s |
| Demo + mediciones tras ese cambio | **272 pasadas, 0 fallidas** |
| Mediciones + tus datos tras el último ajuste | **258 pasadas, 0 fallidas** |

`mediciones.spec.mjs` (32 pruebas por ancho, con obras de prueba inventadas) cubre el enlace de obras (sin duplicar, enlace roto), el panel, las semanas del
mes, paños, puertas y ventanas con los 5 criterios contra las cifras de la sección 2, m³ del vertido, recordar medidas, corregir y
borrar, datos rotos, Excel y resumen línea a línea, el parte semanal en PDF (estructura comprobada: cada entrada de la tabla `xref`
apunta a su objeto y cada `/Length` coincide con su stream; varias páginas con su pie), compartirlo, la certificación en PDF,
desbordes, axe sin violaciones, 44 px y teclado. Los PDF de muestra se revisaron además renderizados con PyMuPDF.

Muestras en `docs/capturas/`: `parte-semanal-mediciones.pdf`, `certificacion-mediciones.pdf` y capturas de móvil y escritorio.

## 6. Lo que Rafael debe confirmar

- Las **calles** de las 5 obras salen del punto de Maps (OpenStreetMap). Si no son las de la obra, se corrigen en Obras.
- Si el contrato de Amra con cada constructora fija **otro criterio de huecos**, manda el contrato (sobre todo en pladur).
- Los datos viven **solo en su móvil**: descargar la copia de seguridad cada viernes desde Ajustes.
