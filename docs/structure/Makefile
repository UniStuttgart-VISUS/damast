.PHONY: all structure.pdf

LATEXMK = latexmk -pdf -interaction=nonstopmode -file-line-error -shell-escape

all: structure.pdf

structure.pdf:
	@$(LATEXMK) $<
