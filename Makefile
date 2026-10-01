.PHONY: all folders references validate gedcom places web html test e2e public report check-template hooks demo screenshots clean refs \
	informe

all: validate gedcom html

# The data folders of families.yml (`paths`), with a .gitkeep in the new ones: the template has none, since their names
# are the tree's. Every target that reads the data runs it first, so a folder Git dropped (empty) comes back
folders:
	uv run scripts/folders.py

references: folders
	uv run scripts/references.py

validate: references
	uv run scripts/validate.py

gedcom: validate
	uv run scripts/export_gedcom.py

# Coordinates of the places for the web's map: looks up in Nominatim the places missing from places.yml (without
# network, it leaves the file as it is and the web is built with the places it already has)
places:
	uv run scripts/geocode.py

# Web interface (TypeScript, in web/): web/dist/web.js and web.css, which build_site.py embeds in index.html
web:
	cd web && pnpm install --frozen-lockfile --silent && pnpm build

# The whole web to open without a server (build/web) and the site's pair: build/public, the public version, which the
# leak check goes through before writing it (if it finds a living person's data, it fails and nothing is written), and
# build/private, the whole tree that deploy/server.py serves only with a session. Then, check that their data (DATA)
# have the shape the interface expects (web/src/types.ts)
html: validate web places
	uv run scripts/build_site.py
	cd web && pnpm exec vitest run test/data-contract.test.ts

# Tests: the scripts on a fictional tree with other folder names, the site's server and the protection of the template
# (check_template.py and the pre-push hook, on scratch repositories) (tests/), the interface's unit
# tests (vitest) and smoke tests in a browser (Playwright, on build/web and on the site served by deploy/server.py)
test: web
	uv run tests/test_scripts.py
	uv run tests/test_server.py
	uv run tests/test_template.py
	cd web && pnpm test

e2e: html
	cd web && pnpm e2e

# Versions to share outside the family, without the living (see scripts/privacy.py): the site (build/public and
# build/private, as the deploy makes it) and a GEDCOM, build/arbre-publico.ged, both through the leak check
public: validate web places
	uv run scripts/build_site.py --only site
	uv run scripts/export_gedcom.py --public -o build/arbre-publico.ged
	uv run scripts/leak_check.py build/public build/arbre-publico.ged
	cd web && pnpm exec vitest run test/data-contract.test.ts

# Documents to read or print outside the repository (without links to files). By default, only the family marked
# `default` in families.yml; `make report FAMILY=<key>` (another of its keys) or `FAMILY=all`.
# FAMILIA (and `todo`) are the former names, still accepted.
FAMILY ?= $(FAMILIA)
report: validate
	uv run scripts/report.py incoherencias $(if $(FAMILY),--family $(FAMILY))
	uv run scripts/report.py pendientes $(if $(FAMILY),--family $(FAMILY))

# No names of the family in the engine's files (scripts/template_paths.txt), which the public template shares
check-template:
	uv run scripts/check_template.py

# The pre-push hook that keeps the family's data and names out of the template (scripts/hooks/pre-push). The hook
# already there, if any, becomes pre-push.local, and the new one runs it after its checks
hooks:
	@hooks=$$(git rev-parse --git-path hooks); mkdir -p "$$hooks"; \
	if [ -e "$$hooks/pre-push" ] && ! cmp -s "$$hooks/pre-push" scripts/hooks/pre-push; then \
		if [ -e "$$hooks/pre-push.local" ]; then echo "$$hooks/pre-push.local already exists: merge it by hand" >&2; exit 1; fi; \
		mv "$$hooks/pre-push" "$$hooks/pre-push.local"; \
		echo "the previous hook is now $$hooks/pre-push.local"; \
	fi; \
	install -m 755 scripts/hooks/pre-push "$$hooks/pre-push"; \
	echo "installed $$hooks/pre-push"

# The demo: a fictional tree (scripts/demo.py, in build/demo-tree) and its whole website in build/demo, with a copy of
# its originals (the scans the generator draws) next to it, so that the folder can be published as it is (GitHub Pages,
# .github/workflows/demo.yml). It does not touch this tree's data
DEMO_TREE = build/demo-tree
DEMO = build/demo
demo: web
	uv run scripts/demo.py $(DEMO_TREE)
	ARBRE_ROOT=$(DEMO_TREE) uv run scripts/references.py
	ARBRE_ROOT=$(DEMO_TREE) uv run scripts/validate.py
	ARBRE_ROOT=$(DEMO_TREE) uv run scripts/build_site.py --only local -o $(DEMO) --originals sources/
	mkdir -p $(DEMO)/sources && cp -r $(DEMO_TREE)/sources/*/ $(DEMO)/sources/

# The screenshots of the READMEs (docs/screenshots), taken with Playwright on the demo
screenshots: demo
	cd web && pnpm exec playwright test -c screenshots.config.ts

# Former names of the targets
refs: references
informe: report

clean:
	rm -rf build web/dist
