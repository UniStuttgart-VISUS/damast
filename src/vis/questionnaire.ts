import { getConsentCookie } from '../common/cookies';
import {
  localStorageKeyUsageTime,
} from '../common/questionnaire';

const updateUsageTimeInterval = 2_000;  // 2 seconds
let updateUseTimeId: any;

function onCookieConsentChanged() {
  clearTimeout(updateUseTimeId);

  initQuestionnaire();
}

export function initQuestionnaire() {
  document.body.addEventListener('cookieconsentchanged', onCookieConsentChanged);

  const consentCookie = getConsentCookie();
  if (consentCookie === null) return;

  const now = Date.now();
  updateUseTimeId = setTimeout(() => updateUseTime(now), updateUsageTimeInterval);
  window.addEventListener('blur', () => clearTimeout(updateUseTimeId));
  window.addEventListener('focus', () => updateUseTime(Date.now()));
}

function getUsageTime() {
  const time = parseInt(localStorage.getItem(localStorageKeyUsageTime));
  if (isNaN(time)) return 0;
  return time;
}

function updateUseTime(lastTime: number) {
  const now = Date.now();
  const timeDelta = Math.floor(now - lastTime);
  const timeUsed = getUsageTime();
  const totalTime = timeDelta + timeUsed;

  localStorage.setItem(localStorageKeyUsageTime, totalTime.toString());
  updateUseTimeId = setTimeout(() => updateUseTime(now), updateUsageTimeInterval);
}
