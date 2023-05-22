.PHONY: all page.pdf

all: page.pdf

layout.pdf: layout.tex
	@latexmk -pdf -interaction=nonstopmode -file-line-error layout.tex

page.pdf: layout.pdf
	@latexmk -pdf -interaction=nonstopmode -file-line-error -shell-escape page.tex
