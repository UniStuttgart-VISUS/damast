# Documentation

This directory contains additional documentation.


## [`postgres`](./postgres/)

This directory contains the code for creating a PDF describing the PostgreSQL database schema.
The schematic details how different tables are connected and interact.
The schematic is also required for the Damast server, and is served via the `docs` blueprint.

## [`structure`](./structure/)

This directory contains the code for creating a PDF describing the server infrastructure.

## [`documentation.tex`](./documentation.tex)

The source file for generating the documentation PDF.
See the [`Makefile`](./Makefile) for build instructions.
In future, a built PDF documentation will be checked into the repository, but as of now, the documentation is incomplete and work in progress.
