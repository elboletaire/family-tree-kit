🇬🇧 [Read in English](README.md)

# Family tree kit

## Empieza tu árbol

Pega esto en un agente de programación con IA (Claude Code, Codex…), abierto en la carpeta donde guardas tus
proyectos. Solo hace falta git: ninguna cuenta de GitHub.

```text
Empieza un árbol genealógico para mí con el kit elboletaire/family-tree-kit.

1. Pregúntame cómo llamar a la carpeta (sugiere «arbol-familiar») y ejecuta
   `git clone https://github.com/elboletaire/family-tree-kit <carpeta>`; luego entra en ella.
2. Renombra el remoto: `git remote rename origin kit`. No es donde se guarda mi árbol: solo trae las actualizaciones
   del kit, y nunca se sube nada a él.
3. Lee AGENTS.md. Comprueba que uv, Node 22 o posterior y pnpm están instalados, y ayúdame a instalar lo que falte.
4. Empieza el árbol con la skill start-tree (.agents/skills/start-tree/SKILL.md): me pregunta dónde guardar el
   árbol, me entrevista, crea las primeras personas y families.yml, y genera la web.
```

Antes, puedes echar un vistazo a la **[demo](https://elboletaire.github.io/family-tree-kit/)**: la web de una familia
inventada, creada por `scripts/demo.py`.

## Qué es

Un árbol genealógico llevado como un repositorio de código: **una ficha markdown por persona** (las relaciones en la
cabecera, la biografía debajo) y **una por documento** (la transcripción, con los escaneos al lado). Cada cambio queda
en el historial de git, cada dato cita el documento del que sale, y unos scripts comprueban el árbol y lo convierten en
una web: un árbol navegable, un abanico de antepasados, una cronología, un «viaje en el tiempo», un mapa de los lugares
de la familia, una galería de documentos y las novedades del árbol (lo que ha cambiado, día a día, leído del historial de
git de los datos), todo visto «con los ojos» de quien elijas. La web se puede publicar con las
personas vivas ocultas (y todo lo demás tras una contraseña).

Está pensado para trabajar con un agente de programación con IA (Claude Code, Codex…): el agente te entrevista,
transcribe los documentos que le das, mantiene las fichas coherentes y pasa las comprobaciones. `AGENTS.md` es su
contrato, y las skills de `.agents/skills`, sus procedimientos.

### Capturas

De la [demo](https://elboletaire.github.io/family-tree-kit/) (`make screenshots` las vuelve a sacar):

| | |
|---|---|
| ![Inicio](docs/screenshots/home.jpg) | ![Árbol](docs/screenshots/tree.jpg) |
| **Inicio**: la familia de un vistazo | **Árbol**: padres, matrimonios, hijos |
| ![Abanico](docs/screenshots/fan.jpg) | ![Cronología](docs/screenshots/timeline.jpg) |
| **Abanico** de antepasados | **Cronología** de vidas, documentos y acontecimientos históricos |
| ![Mapa](docs/screenshots/map.jpg) | ![Persona](docs/screenshots/person.jpg) |
| **Mapa** de los lugares y las migraciones | La **ficha de una persona**: datos, parientes, documentos |
| ![Documentos](docs/screenshots/documents.jpg) | ![Novedades](docs/screenshots/news.jpg) |
| **Documentos**, con los pendientes de revisar | **Novedades**: lo que ha cambiado en el árbol, día a día |

## Empezar a mano

Sin el texto de arriba, los mismos pasos:

1. `git clone https://github.com/elboletaire/family-tree-kit arbol-familiar`, `cd arbol-familiar` y
   `git remote rename origin kit`: `kit` es de donde vienen las actualizaciones del kit, no donde se guarda tu árbol.
2. Instala los requisitos (abajo) y el hook `pre-push` (`make hooks`), que, entre otras cosas, impide subir tu árbol
   a `kit`.
3. Abre tu agente en la carpeta y dile **«quiero empezar mi árbol»** (en cualquier idioma). Sin `families.yml`, sigue
   la skill `start-tree`: pregunta en qué idioma se escribe el árbol y dónde guardarlo, te entrevista sobre ti, tus
   padres y tus abuelos, y crea las primeras fichas, `families.yml` y `TREE.md` (las convenciones de tu propio árbol).
4. `make html` y abre `build/web/index.html`.

**Dónde guardarlo**: solo en tu ordenador (con una copia de seguridad: la carpeta copiada en una nube, un disco
externo…), en un repositorio de GitHub **privado**, o en otro servidor Git que ya tengas. **Nunca público**: el árbol
tiene nombres, fechas y lugares de personas vivas y escaneos de documentos de la familia; la web tiene su propia versión
pública, generada sin los vivos (ver «Publicar la web»).

El repositorio también es una plantilla de GitHub, y **Use this template** funciona, pero es mejor clonarlo: comparte
la historia del kit, así que sus actualizaciones llegan como fusiones normales. Una copia hecha con el botón tiene una
historia sin relación, y su primera actualización necesita `git merge --allow-unrelated-histories` y resolver a mano
cada fichero que haya cambiado desde entonces.

Las skills están en `.agents/skills`; `.claude/skills` es un enlace simbólico a esa carpeta para que Claude Code las
encuentre. En Windows, git solo crea enlaces simbólicos con `core.symlinks=true` y el modo de desarrollador (o una
consola de administrador); si no, trabaja dentro de WSL, o copia `.agents/skills` a `.claude/skills`.

| Skill | Qué hace |
|-------|----------|
| `start-tree` | Empieza un árbol desde cero: entrevista, primeras personas, `families.yml`, `TREE.md` |
| `add-document` | Transcribe un documento o una foto, crea su ficha de fuente y actualiza a las personas que salen |
| `family-interview` | Prepara preguntas para un familiar y convierte sus respuestas en una fuente |
| `genealogy-research` | Busca en hemerotecas, boletines, catálogos de archivos… y anota lo que encuentra como fuentes pendientes |

## Requisitos

- [uv](https://docs.astral.sh/uv/) (instala solo las dependencias de Python).
- [Node](https://nodejs.org/) 22 o posterior y [pnpm](https://pnpm.io/), para la web.
- [Git LFS](https://git-lfs.com/), para los originales (`git lfs pull`).
- Si quieres, [Obsidian](https://obsidian.md/): abre la carpeta del repositorio como *vault*. La vista de grafo
  muestra las conexiones, cada ficha enseña quién la enlaza (los hijos aparecen en los *backlinks*) y
  `templates/persona.md` es la plantilla de una persona nueva.

## Órdenes principales

| Orden | Qué hace |
|-------|----------|
| `make folders` | Crea las carpetas de datos que nombra `families.yml` (`paths`) |
| `make validate` | Regenera las secciones generadas y comprueba enlaces, fechas, cónyuges, ficheros y ciclos |
| `make html` | La web completa en `build/web/index.html` (se abre sin servidor) y el sitio, `build/public/` y `build/private/` |
| `make gedcom` | `build/arbre.ged`, para importar en Gramps, MyHeritage, FamilySearch… |
| `make public` | Solo lo que se comparte fuera de la familia: el sitio y `build/arbre-publico.ged`, sin los vivos |
| `make report` | Los documentos de investigación (incoherencias, pendientes) en PDF, para revisar en papel |
| `make places` | Busca las coordenadas de los lugares nuevos para el mapa (Nominatim de OpenStreetMap) |
| `make test` · `make e2e` | Pruebas de los scripts, el servidor y la interfaz; pruebas de humo en un navegador |
| `make check-template` · `make hooks` | Ningún nombre de la familia en los ficheros del motor; el hook `pre-push` que lo comprueba |
| `make demo` · `make screenshots` | El árbol inventado de la demo y su web en `build/demo`; las capturas de este README |

Las convenciones completas (campos, fechas, niveles de confianza, fotos, qué es público) están en
[AGENTS.md](AGENTS.md).

## Cómo añadir o corregir a alguien

1. Crear `people/nombre-apellido1-apellido2.md` (en Obsidian: nueva nota en la carpeta de personas e insertar la
   plantilla «persona»).
2. Rellenar la cabecera. A los padres y cónyuges se les enlaza con `"[[su-fichero]]"`; los hijos **no** se
   escriben, salen solos de las fichas de los hijos.
3. Un cónyuge va en `spouses` de **las dos** fichas.
4. Indicar de dónde sale cada dato en `sources` (y crear la ficha en la carpeta de fuentes si es un documento nuevo).
5. `make validate` debe terminar con 0 errores.

## Lugares y mapa

La vista **Mapa** pone un punto en cada lugar donde nació, se casó o murió alguien, o de donde es un documento: más
grande cuantos más hechos, y del color del tronco con más gente allí. Las líneas van del lugar de nacimiento de cada
padre o madre al de sus hijos (migraciones); un control de años muestra lo ocurrido hasta un año. El fondo son las
teselas de OpenStreetMap (sin conexión, un contorno aproximado de la costa y los puntos igualmente).

Los lugares son texto libre, así que sus coordenadas se guardan aparte, en `places.yml`, una línea por forma de
escribirlos:

```yaml
"Vilanova (Barcelona)": {lat: 41.22, lon: 1.72, name: "Vilanova"}  # lo que encontró Nominatim
"Por teléfono": {skip: true}       # no es un lugar: no sale en el mapa
"Can Puig, Vilanova": {}           # no encontrado: añadir lat/lon a mano, o skip
```

`make places` busca los que faltan, a una petición por segundo, y añade sus líneas; lo corregido a mano no se toca.
Conviene revisar lo que encuentra: los pueblos pequeños y los homónimos (el comentario de cada línea dice qué lugar
es).

## Publicar la web

Es **una sola web**, que puede estar **cerrada** (así está por defecto) o ser **pública**:

- **Cerrada** (`PUBLIC_SITE=0`, o sin la línea, en el `.env`): sin la contraseña de la familia no se ve nada, solo
  una página que la pide. Dentro, todo el árbol; el **candado** abierto de la barra de arriba cierra la sesión.
- **Pública** (`PUBLIC_SITE=1`): quien entra ve el árbol sin nada de las personas vivas y solo los documentos
  públicos; con el **candado** y la contraseña, todo, en la misma vista.

**Qué es público**: las personas fallecidas, con sus fechas, lugares, retrato y biografía (sin las notas de
investigación). Una persona cuenta como **viva** si su ficha dice `living: true` o si no consta su muerte y nació hace
**menos de 100 años** (sin fecha de nacimiento, se estima por su familia; si no se puede, se trata como viva). De cada
viva solo hay un recuadro «Persona viva» en su sitio del árbol. Los documentos de **más de 100 años que no citan ni
nombran a nadie vivo**, solo su transcripción y su miniatura; los escaneos y los PDF, siempre con contraseña. Nada de
los documentos de investigación. En **Novedades**, solo los cambios de personas fallecidas y documentos públicos. Al generar la web, una **prueba de fugas** busca los nombres, fechas y lugares de los
vivos en cada fichero público: si encuentra algo, la generación falla y no se publica nada.

`docker-compose.yml` levanta un pequeño servidor (`deploy/server.py`, solo biblioteca estándar de Python) detrás de
Traefik:

```sh
git lfs pull                       # los originales, no solo los punteros
cp .env.example .env               # y rellenar DOMAIN, SITE_PASSWORD y SOURCES_DIR (paths.sources)
docker compose run --rm build      # genera build/public y build/private (o `make public` si hay uv, Node y pnpm)
docker compose up -d --build
```

La contraseña (`SITE_PASSWORD`) da una cookie firmada válida `SESSION_DAYS` días desde la última visita; cambiarla (o `SESSION_SECRET`)
cierra todas las sesiones. Tras 5 intentos fallidos desde una IP, cada intento espera el doble, y hay un límite por
hora. El sitio no se deja indexar por los buscadores. Para actualizar la web basta con volver a generar `build/public`
y `build/private`: el contenedor lee `build/` montada, sin reconstruir.

### Despliegue automático

En el servidor, el repositorio es *bare* y **su nombre acaba en `.git`**. El hook
[`deploy/post-receive`](deploy/post-receive) despliega `main` en la carpeta `web/` de al lado en cada push: checkout
sin LFS, cada original sustituido por un **enlace duro** a su objeto de `repo.git/lfs/objects` (así ocupan disco una
sola vez) y la web regenerada con Docker. Si la prueba de fugas encuentra algo, el push termina con error y sigue
publicada la versión anterior. Para instalarlo, dentro del repositorio bare:

```sh
git show main:deploy/post-receive > hooks/post-receive && chmod +x hooks/post-receive
```

El `.env` va en `web/` (el despliegue no lo toca).

## Actualizar el kit

El kit sigue mejorando (arreglos, vistas nuevas, comprobaciones nuevas). Para traer esos cambios a tu árbol, dile a tu
agente **«actualiza el kit»**: siguiendo `AGENTS.md`, trae el remoto `kit`, lo fusiona (`git pull kit main`), resuelve
los conflictos si cambiaste algún fichero del motor, y pasa `make validate` y `make test`. Tus datos nunca chocan: el
kit no tiene ninguno.

## La demo

`make demo` escribe un árbol inventado con `scripts/demo.py` (en `build/demo-tree`: dos familias de pueblos de Galicia
y Andalucía, seis generaciones, personas vivas, documentos con su transcripción y escaneos dibujados, puntos de
investigación) y genera su web completa en `build/demo`, con los escaneos al lado. Nunca toca tu propio árbol, y sale
siempre igual. `make screenshots` saca de ella las capturas de este README.

El workflow [`.github/workflows/demo.yml`](.github/workflows/demo.yml) ejecuta `make demo` en cada push a `main` y
publica `build/demo` en GitHub Pages. **Solo funciona en la propia plantilla** (`elboletaire/family-tree-kit`): en tu
copia sus trabajos se saltan, así que nunca genera ni publica nada tuyo, y puedes dejar el fichero como está (o
borrarlo).

## Idioma

Hoy la web, y todo lo que escriben los scripts (secciones generadas, revisión, informe, GEDCOM), están solo en
**castellano**: es el único idioma que tiene el motor por ahora. **Las traducciones son bienvenidas**: añadir un idioma
son dos ficheros, y un pull request con ellos haría el kit útil para muchas más familias.

- Es configurable: `language` de `families.yml` elige `scripts/i18n_<idioma>.py` y `web/src/i18n/<idioma>.ts`, y
  `paths` da nombre a las carpetas de datos (por defecto `people`, `sources`, `research` y `portraits`), así que un
  árbol puede tener sus carpetas en su idioma.
- Algunas cosas siguen en castellano sea cual sea el idioma: los segmentos de la URL de las vistas (`#arbol`,
  `#abanico`, `#mapa`…, `VIEW_SEGMENT` de `web/src/router.ts`), los valores de los campos (`pendiente`, `revisada`,
  `genealogia`, `rama/`…) y los calificativos de las fechas (`c.`, `antes de`, `después de`, `¿…?`).
- Para añadir un idioma, traduce esos dos ficheros `i18n` (y añádelo a `LANGUAGES` de `web/src/i18n/index.ts`), y
  abre un pull request.

## Licencia

[MIT](LICENSE).
