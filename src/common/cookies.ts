import Cookies from 'js-cookie';

const cookieKey = 'cookieConsent';
const cookiePathNode = document.querySelector('meta[name="cookie-path"]');
const cookiePath = cookiePathNode
  ? cookiePathNode.getAttribute('content')
  : '/';

type SettableCookieConsent = 'essential' | 'all';
export type CookieConsent = null | SettableCookieConsent;

export function getConsentCookie(): CookieConsent {
  const c = Cookies.get(cookieKey);
  if (c === 'essential') return c;
  else if (c === 'all') return c;
  return null;
}

export function clearConsentCookie() {
  Cookies.remove(cookieKey);
  window.localStorage.clear();
}

export function setConsentCookie(consent: SettableCookieConsent) {
  Cookies.set(cookieKey, consent, { expires: 90, path: cookiePath });

  if (consent !== 'all') window.localStorage.clear();
}
