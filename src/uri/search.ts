import * as d3 from 'd3';
export {};

interface Place {
  place_id: number;
  place_name: string;
  place_comment: string | null;
  external_uris: string[];
  name_vars: string[];
};

interface SearchResult {
  priority: [ number, number, number, number ];
  place: Place;
};

const searchField: HTMLInputElement = document.querySelector('.search-bar input');
const clearButton = document.querySelector('.search-bar button.reset');

searchField.value = '';

clearButton.addEventListener('click', function() {
  searchField.value = '';
  searchField.focus();
  render([]);
});


const placePromise = fetch(`../rest/place-list-detailed`)
  .then(async placeList => {
    const places: Place[] = JSON.parse(await placeList.text());
    searchField.addEventListener('input', onInput);

    return places;
  });


async function onInput(evt) {
  const searchText = searchField.value;
  if (searchText.length === 0) return render([]);

  const caseSensitive = (searchText !== searchText.toLowerCase());
  const results = await search(searchText, caseSensitive);
  render(results);
}


function render(results) {
  const ol = d3.select<HTMLOListElement, SearchResult>('section.search-results ol');
  const sel = ol.selectAll<HTMLLIElement, SearchResult>('li')
    .data(results, (d: SearchResult) => d.place.place_id.toString());

  sel.enter()
    .append('li')
    .merge(sel)
    .html(renderOne)
    .attr('data-place-id', (d: SearchResult) => d.place.place_id)
    .sort((a: SearchResult, b: SearchResult) => {
      return (b.priority[0] - a.priority[0])
        || (b.priority[1] - a.priority[1])
        || (b.priority[2] - a.priority[2])
        || (b.priority[3] - a.priority[3]);
    });
  sel.exit().remove();
}

function renderOne(d: SearchResult): string {
  const p = d.place;
  let matchPos = '';
  if (d.priority[0] > 0) matchPos = 'Name matches';
  else if (d.priority[1] > 0) matchPos = 'Alternative name matches';
  else if (d.priority[2] > 0) matchPos = 'Comment matches';
  else matchPos = 'External URI matches';

  return `<a href="./${p.place_id}">
    <span class="place-name">${p.place_name}</span>
    <span class="match-description">${matchPos}</span>
  </a>`;
}


async function search(searchText: string, caseSensitive = false): Promise<SearchResult[]> {
  const places = await placePromise;
  try {
    const regex = new RegExp(searchText, caseSensitive ? '' : 'i');

    const results: SearchResult[] = [];

    places.forEach((p: Place) => {
      const name = regex.exec(p.place_name)?.length || 0;
      const comment = p.place_comment ? (regex.exec(p.place_comment)?.length || 0) : 0;
      let uris = 0;
      p.external_uris.forEach(s => uris += (regex.exec(s)?.length || 0));
      let name_vars = 0;
      p.name_vars.forEach(s => name_vars += (regex.exec(s)?.length || 0));

      const priority: [number, number, number, number] = [ name, name_vars, comment, uris ];
      if (priority.some(d => d > 0)) results.push({ place: p, priority });
    });

    return results;
  } catch (err) {
    if (err instanceof SyntaxError) return [];
    throw err;
  }
}
