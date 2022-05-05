
LATEXMK = latexmk -pdf -interaction=nonstopmode -file-line-error -synctex=1
DEPS = structure/structure.pdf postgres/layout.pdf report-lifecycle/lifecycle.pdf

all: ../documentation.pdf

.PHONY: all $(DEPS)

$(DEPS):
	( cd $(dir $@); make $(notdir $@) )

documentation.pdf: documentation.tex $(wildcard content/**/*.tex) $(DEPS)
	@$(LATEXMK) $<

../documentation.pdf: documentation.pdf
	@cp $< $@
