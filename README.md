# RANKINGS PANORAMICA

PRD FINAL — SITIO WEB

Rol del Asistente (Meta Prompting)
Eres un diseñador/desarrollador experto en UI/UX y Mobile-First, centrado en la estética, conversión y experiencia visual.

Descripción General y Visión
Extensión web bilingüe (catalán por defecto y castellano como segunda opción) para Gastronomic Golf, desplegada en un subdominio tipo classificacio.gastronomicgolf.com, destinada a publicar y seguir el circuito privado de golf 2026 con una experiencia más moderna, premium y muy legible tanto en móvil como en desktop. La solución debe convivir visual y editorialmente con la marca Gastronomic Golf, pero elevar su presentación y la claridad de los datos.

El sitio debe servir para:

 consultar clasificaciones generales y por categoría;

 consultar el detalle de cada jornada;

 explorar fichas de jugador;

 comparar 2 jugadores;

 consultar estadísticas agregadas;

 compartir resultados y exportaciones;

 y apoyar al administrador con una zona privada desde la que importar resultados, revisar incidencias, recalcular clasificaciones, subir fotos y generar una noticia/post automática de jornada en catalán y castellano.

La base funcional y de negocio debe respetar la estructura actual del circuito, que ya publica calendario, clasificación y reglamento, y usar como referencia las reglas publicadas para 2026.

Objetivo de conversión principal:

 Público: que el usuario entre para consultar resultados, clasificaciones, estadísticas y comparativas, y pueda compartirlas fácilmente.

 Administrador: que pueda crear temporada, configurar jornadas, importar resultados desde URLs oficiales, revisar incidencias y generar el contenido editorial post-jornada con el mínimo trabajo manual.

Stack y Restricciones Técnicas
Frontend: React + Tailwind CSS (VITE).
Backend: Requerido, porque el proyecto necesita manejo de datos, backoffice privado, importación de resultados externos, almacenamiento de imágenes, generación de exportaciones y persistencia histórica por temporada.
Autenticación: No requerida para usuarios públicos. Requerida solo para administradores.

Restricciones técnicas y funcionales:

 Sitio público bilingüe con catalán por defecto y cambio visible a castellano.

 Subdominio dedicado, desacoplado de la web principal a nivel de producto, pero coherente visualmente con Gastronomic Golf.

 Diseño mobile-first, sin sacrificar legibilidad ni densidad de información en desktop.

 Toda la información pública debe ser abierta por defecto.

 Debe existir un backoffice privado con gestión de administradores.

 Debe soportar temporada 2026 desde el inicio, dejando preparada la estructura para temporadas futuras.

 Debe admitir múltiples fuentes de resultados. En MVP se contemplan al menos:

 GolfDirecto.

 Teeone.

 Otras futuras fuentes, con arquitectura extensible.

 Importación automática asistida por URLs introducidas por el administrador.

 Validación previa de la importación:

 nombre del torneo,

 fecha/jornada,

 club/campo,

 coincidencia razonable de jugadores esperados,

 y presencia de tarjeta disponible por jugador cuando la fuente lo permita.

 Si hay inconsistencias, la importación no se bloquea por defecto: se permite importar con aviso, mostrando claramente qué no se ha importado y por qué.

 En Teeone, el sistema debe contemplar que la tarjeta completa puede requerir abrir una URL adicional por jugador.

 El sistema debe almacenar estados de jornada:

 borrador,

 importada,

 revisar,

 validada,

 publicada.

 La generación de noticias será automática, pero siempre en formato borrador editable/exportable; la publicación final seguirá siendo manual.

 La exportación del contenido editorial debe permitir:

 copiar al portapapeles,

 descargar un documento.

 Deben existir exportaciones de datos y recursos visuales:

 PDF,

 Excel/CSV,

 imágenes para WhatsApp/redes,

 exportación de fichas o bloques compartibles,

 y enlaces públicos compartibles.

Flujo de Usuario y Estructura de Navegación
Estructura pública propuesta, con nomenclatura más limpia y moderna:

 Visión general / Visió general

 Rankings / Rànquings

 Jornadas

 Jugadores

 Comparador

 Estadísticas

 Noticias

 Temporada 2026 / selector de temporada futura

 Cambio de idioma CAT / ES

Flujo público principal:

 El usuario entra en la portada de la extensión.

 Ve un resumen de temporada:

 próxima o última jornada,

 destacados,

 accesos rápidos a rankings,

 comparador,

 estadísticas,

 y última noticia de jornada.

 Desde Rankings accede a clasificaciones con filtros y vistas:

 handicap bajo,

 handicap alto,

 scratch,

 femenina,

 senior,

 y filtros por jornada, categoría y temporada.

 Desde Jornadas accede al calendario y al detalle de cada prueba:

 fecha,

 club/campo,

 sponsor,

 links relevantes,

 resultados,

 scratch,

 categorías,

 femenina,

 senior,

 tarjetas hoyo a hoyo,

 galería,

 y noticia-resumen.

 Desde Jugadores accede a la ficha individual:

 foto opcional,

 club opcional,

 licencia,

 hándicap inicial de temporada,

 hándicap de la última prueba jugada,

 resultados por jornada,

 evolución,

 birdies/pares/bogeys si hay datos suficientes,

 hoyos destacados,

 y acceso a comparar con otro jugador.

 Desde Comparador selecciona 2 jugadores y visualiza comparación directa:

 resultados,

 medias,

 posiciones,

 regularidad,

 birdies,

 pares,

 mejor vuelta,

 y evolución.

 Desde Estadísticas consulta rankings agregados y también puede comparar 2 jugadores.

 Desde Noticias consulta la pieza editorial generada para cada jornada y puede compartirla.

Flujo privado de administración:

 El administrador inicia sesión.

 Puede crear temporada nueva.

 Al crear temporada, el sistema pregunta si las reglas cambian; si no cambian, hereda la configuración anterior.

 El administrador configura calendario y sponsor de cada prueba si lo hay.

 Para una jornada concreta, crea o edita la prueba y pega una o varias URLs oficiales.

 El sistema valida la fuente, detecta coincidencias y discrepancias, y presenta advertencias si algo no cuadra.

 El administrador puede continuar con la importación, revisar lo no importado y corregir manualmente.

 El sistema recalcula clasificaciones y estadísticas.

 El administrador puede subir fotos:

 premiados por categoría,

 y fotos “beauty” de galería.

 Antes de generar la noticia, el sistema reconfirma sponsor y permite añadir mención especial.

 El sistema genera una noticia general de jornada en 2 tonos posibles:

 periodístico deportivo,

 cercano.

 La salida editorial incluye:

 titular,

 subtítulo,

 cuerpo,

 destacados,

 extracto SEO,

 propuesta de enfoque,

 y contenido listo para copiar o descargar.

 La noticia queda como borrador exportable; la publicación final es manual.

 El administrador puede crear nuevos administradores, editarlos y eliminarlos.

Funcionalidades Clave

 Sitio público bilingüe

 Catalán por defecto.

 Castellano como segunda opción.

 Cambio de idioma visible y consistente en navegación, etiquetas, filtros y contenidos generados.

 Página de Visión general

 Resumen premium de temporada.

 Última jornada / próxima jornada.

 Destacados.

 CTA claros hacia rankings, jornadas, estadísticas y comparador.

 Módulos altamente legibles en móvil y desktop.

 Rankings

 Clasificación general por temporada.

 Vistas para:

 handicap bajo,

 handicap alto,

 scratch,

 femenina,

 senior.

 Filtros por jornada, categoría y temporada.

 Visualización clara de posición, licencia, nombre, puntuaciones, total y variación si se implementa.

 Posibilidad de exportar y compartir.

 Jornadas

 Listado de jornadas del calendario.

 Detalle de jornada con:

 información básica,

 sponsor,

 resultados por categoría,

 scratch,

 femenina,

 senior,

 inscritos si están disponibles,

 tarjetas hoyo a hoyo,

 galería,

 noticia/resumen.

 Convivencia de jornadas con varios días de juego dentro de la misma prueba.

 Tratamiento correcto de jugadores que no participan en todas las pruebas.

 Jugadores

 Ficha pública por jugador.

 Identificación principal por licencia para evitar duplicados.

 Campos:

 licencia,

 nombre,

 foto opcional,

 club opcional,

 hándicap inicial de temporada,

 hándicap de la última prueba jugada,

 resultados por jornada,

 evolución,

 birdies/pares/bogeys si procede,

 hoyos destacados.

 Comparación directa entre 2 jugadores.

 Estadísticas
Estadísticas mínimas del MVP:

 más birdies,

 más pares,

 media Stableford,

 media scratch,

 mejor vuelta,

 regularidad,

 top 10 frecuentes,

 comparación entre 2 jugadores.

 Backoffice de administración

 Login privado solo para admins.

 Gestión de administradores:

 alta,

 edición,

 eliminación.

 Gestión de temporadas.

 Generación de nueva temporada heredando reglas y estructura si no cambian.

 Configuración de calendario y sponsor por prueba.

 Gestión de jornadas y estado de publicación.

 Importación por URLs.

 Revisión de incidencias y avisos.

 Corrección manual de datos cuando sea necesario.

 Recalcular clasificaciones y estadísticas.

 Subida de fotos de premiados y galería.

 Importación automática de resultados

 Soporte inicial para GolfDirecto.

 Soporte inicial para Teeone.

 Arquitectura preparada para añadir nuevas fuentes.

 Extracción de:

 nombre del jugador,

 licencia,

 hándicap de participación,

 resultado scratch,

 resultado por categoría,

 tarjeta completa cuando esté disponible.

 En Teeone, apertura de ficha/tarjeta individual por jugador cuando la tarjeta esté en una URL adicional.

 Validación previa y avisos de inconsistencias.

 Importación permitida con aviso, no bloqueo duro por defecto.

 Registro de qué no se ha importado y por qué.

 Generación automática de noticia/post de jornada

 Una única noticia general por jornada.

 Generación en catalán y castellano.

 Dos tonos de salida:

 periodístico deportivo,

 más cercano.

 Incorporación de sponsors de la prueba.

 Posibilidad de añadir una mención especial antes de generar.

 Detección y aprovechamiento editorial de hitos como:

 ganadores por categoría,

 mejores clasificados,

 hoyo en uno,

 más birdies,

 rendimiento destacado hoyo a hoyo,

 y cualquier otro hecho relevante derivable de la tarjeta completa.

 La noticia debe generarse como borrador exportable, no publicarse automáticamente.

 Salidas:

 copiar al portapapeles,

 documento descargable.

 Debe incluir:

 titular,

 subtítulo,

 cuerpo,

 destacados,

 extracto SEO.

 Compartición y exportaciones

 Exportar clasificaciones y resultados a PDF.

 Exportar datos a Excel/CSV.

 Generar imágenes compartibles para WhatsApp y redes.

 Compartir por enlace público.

 Exportar fichas o bloques relevantes cuando aplique.

 Reglas de negocio del circuito
El proyecto debe tomar como referencia el reglamento publicado del circuito 2026, incluyendo como base la modalidad Stableford, categorías por hándicap, categoría fijada por la primera prueba, cómputo de las 8 mejores puntuaciones, una prueba MASTER con coeficiente 1,25, posibilidad de jugar una misma prueba en días distintos contando solo el mejor resultado y la lógica de desempates publicada. También se contemplan premio scratch y premios de jornada como femenina y senior en la operativa del circuito. Cualquier futura temporada debe preguntar si las reglas cambian; si no cambian, deben heredarse.

Lineamientos de Diseño UI/UX
Estilo visual: premium, elegante y contemporáneo, alineado con Gastronomic Golf, con una sensibilidad más refinada y “gastronómica” que deportiva genérica. Debe transmitir exclusividad, orden, claridad y valor editorial.

Criterios de diseño:

 Mantener identidad de marca Gastronomic Golf, modernizando su ejecución.

 Priorizar visibilidad del dato:

 tablas legibles,

 filtros claros,

 jerarquías fuertes,

 tipografía limpia,

 alto contraste útil,

 espaciado generoso.

 Móvil y desktop al mismo nivel de importancia.

 Navegación limpia y moderna, con nombres de sección sencillos.

 Diseño de tablas y comparativas optimizado para consulta rápida.

 Integración visual de noticias, galerías y patrocinadores sin perder elegancia.

 Estados de interfaz bien resueltos:

 carga,

 vacío,

 error,

 aviso de importación incompleta,

 sin datos suficientes.

 Visualización premium de cards, rankings y módulos de estadísticas.

 Galería con buen peso visual para fotos de premiados y fotos “beauty”.

 Bilingüismo cuidado también a nivel de microcopy y UX.

 La extensión debe sentirse coherente con la web principal, que actualmente mezcla calendario, reglamento, clasificación y patrocinio del circuito, pero con una capa visual superior y más actual.

Alcance del Proyecto (Scope)
Incluido:

 Extensión web en subdominio dedicada a la clasificación y seguimiento del circuito.

 Sitio público bilingüe CAT/ES.

 Backoffice privado para administradores.

 Gestión de administradores.

 Temporada 2026 operativa desde el inicio.

 Estructura preparada para futuras temporadas.

 Generación de nuevas temporadas con herencia de reglas si no cambian.

 Gestión de calendario y sponsors por prueba.

 Importación automática asistida por URLs.

 Soporte MVP para GolfDirecto y Teeone.

 Arquitectura extensible para nuevas fuentes.

 Validación previa y sistema de avisos de importación.

 Rankings:

 handicap bajo,

 handicap alto,

 scratch,

 femenina,

 senior.

 Páginas de jornadas, jugadores, comparador y estadísticas.

 Ficha individual de jugador.

 Comparación entre 2 jugadores en jugadores y estadísticas.

 Estadísticas MVP definidas.

 Subida de fotos de premiados y galería.

 Generación automática de noticia/post de jornada en catalán y castellano.

 Dos tonos editoriales para la noticia.

 Exportación por copia al portapapeles y documento descargable.

 Exportaciones a PDF, Excel/CSV e imágenes para compartir.

 Botones o mecanismos de compartición pública.

Excluido:

 Publicación automática directa de noticias en la web principal.

 Área privada para jugadores o socios.

 Registro/login de usuarios públicos.

 Pagos, ecommerce o membresía.

 App móvil nativa.

 Automatizaciones avanzadas no confirmadas con terceros externos.

 Integraciones adicionales no especificadas más allá de las fuentes de resultados previstas.

 Redefinición del reglamento: la web debe aplicar las reglas vigentes y solo preguntar cambios al generar nuevas temporadas.

 Rehacer la web principal de Gastronomic Golf.

 Página específica de reglamento dentro de la extensión, ya que seguirá residiendo en la web principal.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bb88ee72-0442-414c-bcf9-7efa190f43df).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
