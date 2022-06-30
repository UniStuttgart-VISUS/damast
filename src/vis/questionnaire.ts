import { getConsentCookie } from '../common/cookies';
import { showInfoboxFromURL } from './modal';
import {
  localStorageKeyUsageTime,
  localStorageKeyQuestionnaire,
  QuestionnaireState
} from '../common/questionnaire';

const updateUsageTimeInterval = 2_000;  // 2 seconds
const checkInterval = 300_000;  // 5 minutes
const triggerTimeMs = 900_000;  // 15 minutes
//
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
  setTimeout(async () => regularCheck(), checkInterval);
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

async function regularCheck() {
  const questionnaireState: QuestionnaireState = (localStorage.getItem(localStorageKeyQuestionnaire) ?? QuestionnaireState.NotYet) as QuestionnaireState;

  if (questionnaireState === QuestionnaireState.DoNotWant) return;
  if (questionnaireState === QuestionnaireState.Done) return;

  const totalTime = getUsageTime();

  if (totalTime >= triggerTimeMs) {
    await showAskDialog();
    return;
  }

  const now = Date.now();
  setTimeout(async () => regularCheck(), checkInterval);
}

async function showAskDialog() {
  return new Promise<void>(async (resolve, _reject) => {
    const descriptionPromise = Promise.resolve('');
    const { content, close } = showInfoboxFromURL(
      'Fill out questionnaire',
      async () => descriptionPromise,
      false,
      () => resolve(),
    );
    const sel = await content;

    sel.innerHTML = require('html-loader!./html/questionnaire-intro.template.html').default;
    sel.querySelector(':scope button#no-thanks')
      .addEventListener('click', () => {
        close();
        localStorage.setItem(localStorageKeyQuestionnaire, QuestionnaireState.DoNotWant);
        resolve();
      });

    sel.querySelector(':scope button#not-now')
      .addEventListener('click', () => {
        close();
        localStorage.setItem(localStorageKeyQuestionnaire, QuestionnaireState.NotYet);
        resolve();
      });
    sel.querySelector(':scope button#yes')
      .addEventListener('click', () => {
        close();
        document.querySelector<HTMLAnchorElement>('a#questionnaire-link')?.click();
        resolve();
      });
  });
}
