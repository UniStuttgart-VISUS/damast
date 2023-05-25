export NODE_OPTIONS=--max-old-space-size=8192

all: dev

.PHONY: all dev prod clean css@dev css@prod geodb@dev geodb@prod databaseschemafile CHANGELOG LICENSE

dev: databaseschemafile CHANGELOG LICENSE
	npx webpack --stats errors-only --mode development

prod: clean databaseschemafile CHANGELOG LICENSE
	npx webpack --stats errors-only --mode production

databaseschemafile:
	(cd docs/postgres; make page.pdf)
	mkdir -p damast/docs/assets
	brotli -Zkfo damast/docs/assets/database_schema.pdf.br docs/postgres/page.pdf

CHANGELOG:
	node util/build/compile-html-changelog.mjs CHANGELOG.md damast/docs/templates/docs/changelog_contents.html

LICENSE:
	cp $@ damast/docs/templates/docs/license.txt
	cp $@ damast/reporting/templates/reporting/license.txt

clean:
	@git clean -fX damast/
	@rm -vf damast/docs/assets/database_schema.pdf.br
