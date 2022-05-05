.PHONY: all

LATEXMK = latexmk -pdf -interaction=nonstopmode -file-line-error -shell-escape

all: structure.pdf

structure.pdf: structure.tex
	@$(LATEXMK) $<
