import AnnotatorHelper from './annotator-helper';

const params = new URLSearchParams(window.location.search);

// get rid of TS1378
(async () => {
  try {
    // get document id from URL parameter
    const document_id = params.get('document_id');

    if (document_id === null) throw new Error('No document ID given!');
    if (!/^\d+$/.test(document_id)) throw new Error('Document ID is not a number!');

    const id = parseInt(document_id);
    const scroll_parent: HTMLDivElement = document.querySelector('section.annotation-area div.scroll-parent');
    const ann = new AnnotatorHelper(scroll_parent, id);

    await ann.initialLoad()
      .then(() => console.log('annotations loaded'));
  } catch (err) {
    params.delete('document_id');
    const loc = new URL(window.location.toString());
    loc.search = params.toString();

    const main = document.querySelector('main');
    main.innerHTML = `
      <h1>Invalid document selected</h1>

      <pre>${err.message}</pre>

      <p>Going back to document selection...</p>`;
    main.classList.add('invalid-document-error-message');

    setTimeout(() => window.location.replace(loc.href), 5000);
  }
})();
