.PHONY: all

LATEXMK = latexmk -pdf -interaction=nonstopmode -file-line-error -shell-escape

all: lifecycle.pdf

lifecycle.pdf: lifecycle.tex
	@$(LATEXMK) $<
