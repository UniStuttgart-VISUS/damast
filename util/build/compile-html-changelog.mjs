import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { readFileSync, writeFileSync } from 'fs';

marked.use(gfmHeadingId());
const [_, __, infile, outfile] = process.argv;

writeFileSync(
  outfile,
  marked(
    readFileSync(
      infile,
      { encoding: 'utf8' }
    ),
    {
      mangle: false,
      gfm: true,
    }
  )
);

