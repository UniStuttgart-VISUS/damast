import * as d3 from 'd3';
import { create_dialog } from '../common/dialog';
import { Place, User } from './datatypes';
import { getConsentCookie } from '../common/cookies';

interface PlaceSet {
  uuid: string;
  description: string;
  filter: number[];
  date: string;
  username: string;
  source: 'local' | 'db' | 'new';
};


async function getSavedPlaceSets(user: User): Promise<PlaceSet[]> {
  const locals: PlaceSet[] = (getConsentCookie() !== 'all')
    ? []
    : JSON.parse(window.localStorage.getItem('damast.place-sets') || '[]');
  locals.forEach(d => d.source = 'local');

  // load from DB if allowed to
  if (user.readdb) {
    const db: Omit<PlaceSet, 'source'>[] = await d3.json('../rest/place-set');
    db.forEach(d => {
      locals.push({...d, source: 'db'});
    });
  }

  locals.sort((a,b) => +(new Date(b.date)) - +(new Date(a.date)));
  return locals;
}

async function savePlaceSets(user: User, placesets: PlaceSet[], idx: number | null) {
  const locals = placesets.filter(d => d.source === 'local');

  if (idx === null) {
    // new
    const newset = placesets.find(d => d.source === 'new');
    console.assert(newset !== null);
    if (user.writedb) {
      const uuid = await d3.text('../rest/place-set',
        {
          method: 'POST',
          body: JSON.stringify(newset),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      console.log('Created new remote place set with UUID', uuid);
    } else {
      newset.source = 'local';
      locals.push(newset);
      console.log('Created new local place set');
    }
  } else {
    const d = placesets[idx];

    if (d.source === 'db') {
      if (user.writedb) {
        await d3.text('../rest/place-set',
          {
            method: 'POST',
            body: JSON.stringify(d),
            headers: {
              'Content-Type': 'application/json',
            },
          });
        console.log('Updated remote place set with UUID', d.uuid);
      } else {
        locals.push({
          ...d,
          uuid: '',
          source: 'local',
        });
        console.log('Created new local place set from remote place set with UUID', d.uuid);
      }
    }
  }

  if (getConsentCookie() === 'all') window.localStorage.setItem('damast.place-sets', JSON.stringify(locals));
}


export async function saveCurrentFilter(filter: Set<number>, user: User) {
  const create_fn = async (sel: d3.Selection<HTMLDivElement, any, any, any>, resolve, reject) => {
    sel.append('h3')
      .classed('modal__title', true)
      .html('Save Place Set');
    const content = sel.append('div')
      .classed('modal__content', true)
      .classed('place-set-manager', true);
    const footer = sel.append('div')
      .classed('modal__footer', true);
    const cancel = footer.append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .html('<i class="fa fa-reply fa--pad-right"></i>Cancel')
      .on('click', _ => reject(<void>undefined))
      .classed('button--cancel', true);

    const save = footer.append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .classed('button--green', true)
      .html('<i class="fa fa-save fa--pad-right"></i>Save')
      .on('click', () => {})
      .attr('disabled', '');

    const parent = sel.node().parentElement;
    d3.select(parent).on('click', e => {
      if (e.target === parent) reject(<void>undefined);
    });

    const sv = await getSavedPlaceSets(user);
    sv.forEach((s, i) => {
      if (s.source === 'db' && !user.writedb) return;

      const d = content.append('div')
        .classed('form-item', true);
      const label = `save-option-${i}`;
      d.append('input')
        .attr('type', 'radio')
        .attr('name', 'save-slot')
        .attr('value', i)
        .attr('id', label)
        .on('change', () => save.on('click', async () => {
          const datum = {
            uuid: s.uuid,
            filter: Array.from(filter),
            username: user.user,
            date: new Date().toISOString(),
            description: s.description,
            source: s.source,
          };

          sv[i] = datum;

          await savePlaceSets(user, sv, i);
          resolve();
        }).attr('disabled', null));
      d.append('label')
        .attr('for', label)
        .classed('place-set-description', true)
        .html(`<span class="title">${s.description}</span><span class="source">${s.source}</span><p class="description">Last saved by <strong>${s.username}</strong> on <time>${s.date}</time> with <strong>${s.filter.length}</strong> places.</p>`)
    });

    const d = content.append('div')
      .classed('form-item', true);
    d.append('input')
      .attr('type', 'radio')
      .attr('name', 'save-slot')
      .attr('value', 'new')
      .attr('id', 'new-slot')
      .on('change', () => save.on('click', async () => {
        const datum: PlaceSet = {
          uuid: '',
          filter: Array.from(filter),
          username: user.user,
          date: new Date().toISOString(),
          description: text.node().value,
          source: 'new',
        };

        sv.push(datum);
        await savePlaceSets(user, sv, null);
        resolve();
      }).attr('disabled', null));
    const text = d.append('input')
      .attr('type', 'text');
  };

  const dial = create_dialog(d3.select('body'), create_fn);
  return await dial;
}

export async function loadFilter(user: User): Promise<number[]> {
  const sv = await getSavedPlaceSets(user);
  if (sv.length === 0) return await create_dialog<number[]>(
    d3.select('body'),
    async (sel, resolve, reject) => {
      sel.append('h3')
        .classed('modal__title', true)
        .html('Load Place Set');
      const content = sel.append('div')
        .classed('modal__content', true);
      content.append('p')
        .text('No place sets found.');
      const footer = sel.append('div')
        .classed('modal__footer', true);
      const cancel = footer.append('button')
        .classed('button', true)
        .classed('button--medium', true)
        .html('<i class="fa fa-check fa--pad-right"></i>Okay')
        .on('click', _ => reject(<void>undefined))
        .classed('button--cancel', true);
    });
  const create_fn = (sel: d3.Selection<HTMLDivElement, any, any, any>, resolve, reject) => {
    sel.append('h3')
      .classed('modal__title', true)
      .html('Load Place Set');
    const content = sel.append('div')
      .classed('modal__content', true)
      .classed('place-set-manager', true);
    const footer = sel.append('div')
      .classed('modal__footer', true);
    const cancel = footer.append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .html('<i class="fa fa-reply fa--pad-right"></i>Cancel')
      .on('click', _ => reject(<void>undefined))
      .classed('button--cancel', true);

    const parent = sel.node().parentElement;
    d3.select(parent).on('click', e => {
      if (e.target === parent) reject(<void>undefined);
    });

    sv.forEach((s, i) => {
      const d = content.append('button')
        .classed('button', true)
        .classed('place-set-description', true)
        .html(`<span class="title">${s.description}</span><span class="source">${s.source}</span><p class="description">Last saved by <strong>${s.username || 'unknown'}</strong> on <time>${s.date}</time> with <strong>${s.filter.length}</strong> places.</p>`)
        .on('click', () => resolve(s.filter));
    });
  };

  const dial = create_dialog<number[]>(d3.select('body'), create_fn);
  return await dial;
}
