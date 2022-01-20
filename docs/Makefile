
LATEXMK = latexmk -pdf -interaction=nonstopmode -file-line-error -shell-escape
DEPS = structure/structure.pdf postgres/layout.pdf report-lifecycle/lifecycle.pdf

all: documentation.pdf

.PHONY: all $(DEPS)

$(DEPS):
	( cd $(dir $@); make $(notdir $@) )

documentation.pdf: documentation.tex $(wildcard content/**/*.tex) $(DEPS)
	@$(LATEXMK) $<
