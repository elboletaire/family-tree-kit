"""Spanish texts that the family reads: the generated sections of the notes, revision.md, the web data and the
report. The code stays in English; anything a reader sees comes from here.

Chosen with `language: es` in families.yml. Another language is a copy of this file, i18n_<language>.py, with the
same names (and its web/src/i18n/<language>.ts)."""

# --- Generated sections of the notes (arbre.generated_files)
REFS_HEADING_PERSON = "Referencias"
REFS_HEADING_SOURCE = "Personas mencionadas"

# --- Research documents
OTHER_FAMILIES_GROUP = "Otras familias"


def pending_docs(n):
    return f"{n} {'documento pendiente' if n == 1 else 'documentos pendientes'}"


# How each shared section counts its documents in the revision.md summary (families use their own `of`)
SEVERAL_OF = "de varias"
GENERAL_OF = "sin personas"

REVISION_TITLE = "# Revisión de lo hallado por investigación automática"
REVISION_GENERATED = "<!-- generado con `make refs` a partir del campo `review` de las fuentes; no editar a mano -->"
def revision_intro(sources):
    """`sources`: the folder of the sources (`paths.sources` in families.yml)."""
    return [
        "Estas fuentes no vienen del Drive ni de la familia: las encontró una investigación automática (IA) en",
        "hemerotecas, boletines oficiales e índices de archivos. Los datos que dependen solo de ellas son",
        "**provisionales** hasta que alguien de la familia las revise.",
        "",
        f"- **Aprobar una fuente**: en su ficha (`{sources}/F0xx.md`) se cambia `review: pendiente` por",
        "  `review: revisada` y se añade quién y cuándo, p. ej. `reviewed_by: \"Nombre, 2026-10-02\"`. También",
        "  se le puede pedir a Claude.",
        "- **Si una fuente es errónea** (otra persona, otra familia, un dato mal leído): se borra la fuente y, con",
        "  ella, los datos que dependen de ella. Las personas marcadas «se quedaría sin fuentes» no tienen otra",
        "  prueba y saldrían del árbol; las de la lista final de cada familia dependen solo de fuentes pendientes.",
    ]


def revision_split_intro(titles):
    return ("Los documentos van por familias según las personas que los citan: "
            + ", ".join(f"«{t}»" for t in titles) + " y, aparte, los que tocan a varias.")


def revision_summary(docs, split, people, new):
    return (f"**{docs} de revisar** ({split}), que aportan datos de {people} personas; {new} de ellas solo "
            "aparecen en fuentes pendientes (nuevas, por revisar).")


def join_and(items):
    return " y ".join([", ".join(items[:-1]), items[-1]]) if len(items) > 1 else "".join(items)


# Label of the line that opens each document; the web counts the documents of a section by it
REVISION_DOCUMENT_LABEL = "Documento"
REVISION_DOCUMENT = "- **" + REVISION_DOCUMENT_LABEL + "**: [abrir {sid}]({href})"
REVISION_DATE_ORIGIN = "- **Fecha y procedencia**: {}"
REVISION_FOUND = "- **Cómo se encontró**: {}"
REVISION_PEOPLE = "- **Aporta datos de**:"
REVISION_LEFT_WITHOUT = " — **se quedaría sin fuentes**"
REVISION_NOT_CITED = "- No la cita ninguna persona."
REVISION_NO_DOCS = "Ningún documento pendiente."
REVISION_NEW_PEOPLE = "### Personas nuevas, por revisar"
REVISION_NEW_PEOPLE_INTRO = "Todas sus fuentes están pendientes de revisar:"

# --- Web data (build_site.py)
HISTORIC_EVENTS = [
    (1895, 1898, "Guerra de Cuba"),
    (1914, 1918, "Primera Guerra Mundial"),
    (1936, 1939, "Guerra Civil"),
    (1939, 1945, "Segunda Guerra Mundial"),
    (1975, 1978, "Transición"),
]
CATEGORY_LABEL = {"genealogia": "Genealogía", "foto": "Fotografías", "arbol": "Árboles",
                  "contexto": "Contexto", "patrimonio": "Patrimonio", "ia": "Generado por IA"}
CITE_PENDING_TITLE = "Hallado por investigación automática · pendiente de revisar"

# --- GEDCOM
GEDCOM_SIBLINGS_ONLY = "Hermanos de padres desconocidos"

# --- Printable report (report.py)
REPORT_LANG = "es"
REPORT_CITED_DOCS = "Documentos citados"
REPORT_ABOUT = "Sobre: {}"
REPORT_WHERE = "Dónde está: {}"

# --- Places (geocode.py): language of the names Nominatim answers with, and the word that joins two places in a
# text («Cuenca y Albacete»)
GEOCODE_LANGUAGE = "es"
PLACE_AND = "y"

# --- Public version (privacy.py, build_site.py, export_gedcom.py)
# Name of a living person in the public version, and what replaces the links to them in the texts of the deceased
LIVING_PERSON_NAME = "Persona viva"
LIVING_PERSON_TEXT = "persona viva"
# Heading of the research notes of a person's note: the public version leaves them out
RESEARCH_NOTES_HEADING = "Notas de investigación"
MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
               "noviembre", "diciembre"]


def long_date(day, month, year):
    return f"{day} de {month} de {year}"


def month_year(month, year):
    return f"{month} de {year}"
