.PHONY: all

LATEXMK = latexmk -pdf -interaction=nonstopmode -file-line-error -shell-escape

all: page.pdf

structure.pdf: structure.tex
	@$(LATEXMK) $<

page.pdf: page.tex structure.pdf
	@$(LATEXMK) $<
