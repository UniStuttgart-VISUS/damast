.PHONY: all

all: page.pdf

layout.pdf: layout.tex
	@latexmk -pdf -interaction=nonstopmode -file-line-error layout.tex

page.pdf: page.tex layout.pdf
	@latexmk -pdf -interaction=nonstopmode -file-line-error -shell-escape page.tex
