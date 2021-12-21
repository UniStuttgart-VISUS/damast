export NODE_OPTIONS=--max-old-space-size=8192

all: dev

.PHONY: all dev prod clean css@dev css@prod geodb@dev geodb@prod databaseschemafile CHANGELOG

dev: databaseschemafile CHANGELOG
	npx webpack --stats errors-only --mode development

prod: clean databaseschemafile CHANGELOG
	npx webpack --stats errors-only --mode production

databaseschemafile:
	(cd docs/postgres; make page.pdf)
	mkdir -p dhimmis/docs/assets
	brotli -Zkfo dhimmis/docs/assets/database_schema.pdf.br docs/postgres/page.pdf

CHANGELOG:
	cp $@ dhimmis/docs/templates/docs/changelog.txt

clean:
	@git clean -fX dhimmis/
	@rm -vf dhimmis/docs/assets/database_schema.pdf.br
