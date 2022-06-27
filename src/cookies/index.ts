import {
  getConsentCookie,
  setConsentCookie,
  clearConsentCookie
} from '../common/cookies';

const consentForm = document.querySelector('div.cookies__content');

if (getConsentCookie() !== 'essential') window.localStorage.clear();

if (consentForm !== null) {
  const save = consentForm.querySelector(':scope button#save-cookie-policy');
  const standalone = save.getAttribute('data-standalone') === "true";

  const other: Clickable[] = standalone
    ? []
    : disableOther();

  save.addEventListener('click', () => {
    const saveIcon = save.querySelector(':scope .fa');
    saveIcon.classList.remove('fa-save');
    saveIcon.classList.add('fa-pulse', 'fa-spinner');
    save.setAttribute('disabled', '');

    const val = consentForm.querySelector<HTMLInputElement>(':scope input[name="policy"]:checked').value;

    switch (val) {
      case 'none':
        clearConsentCookie();
        break;
      case 'essential':
        setConsentCookie('essential');
        break;
    }

    saveIcon.classList.remove('fa-pulse', 'fa-spinner');
    saveIcon.classList.add('fa-check');

    if (!standalone) {
      // get and remove cookie parent
      const parent = document.querySelector('body div.cookies');
      parent.remove();

      for (const node of other) node.removeAttribute('disabled');

      // if page is transient, proceed
      const next = document.querySelector<HTMLLinkElement>('link[rel="next"]');
      if (next) window.location.replace(next.href);
      else {
        document.body.dispatchEvent(new CustomEvent('cookieconsentchanged'));
      }
    } else {
      window.location.reload();
    }
  });
}

type Clickable = HTMLButtonElement | HTMLInputElement;
function disableOther(): Clickable[] {
  const nodes: Clickable[] = [];
  const ownNodes = new WeakSet<Clickable>();
  consentForm.querySelectorAll<HTMLButtonElement>(':scope button:not(:disabled)').forEach(v => ownNodes.add(v));
  consentForm.querySelectorAll<HTMLInputElement>(':scope input:not(:disabled)').forEach(v => ownNodes.add(v));

  document.querySelectorAll<HTMLButtonElement>('button:not(:disabled)').forEach(v => {
    if (!ownNodes.has(v)) nodes.push(v);
  });
  document.querySelectorAll<HTMLInputElement>('input:not(:disabled)').forEach(v => {
    if (!ownNodes.has(v)) nodes.push(v);
  });

  for (const node of nodes) node.setAttribute('disabled', '');

  return nodes;
}
