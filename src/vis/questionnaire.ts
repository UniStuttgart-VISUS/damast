import { getConsentCookie } from '../common/cookies';
import { showInfoboxFromURL } from './modal';
import {
  localStorageKeyUsageTime,
  localStorageKeyQuestionnaire,
  QuestionnaireState
} from '../common/questionnaire';

const checkInterval = 5000;  // XXX
const triggerTimeMs = 15000;//1_800_000  // 30min

export function initQuestionnaire() {
  const consentCookie = getConsentCookie();
  if (consentCookie === null) return;

  const now = Date.now();
  setTimeout(async () => regularCheck(now), checkInterval);
}

async function regularCheck(lastTime: number) {
  const timeDelta = Math.floor(Date.now() - lastTime);
  const timeUsed = parseInt(localStorage.getItem(localStorageKeyUsageTime)) ?? 0;
  const totalTime = timeDelta + timeUsed;

  localStorage.setItem(localStorageKeyUsageTime, totalTime.toString());

  const questionnaireState: QuestionnaireState = (localStorage.getItem(localStorageKeyQuestionnaire) ?? QuestionnaireState.NotYet) as QuestionnaireState;

  if (questionnaireState === QuestionnaireState.DoNotWant) return;
  if (questionnaireState === QuestionnaireState.Done) return;

  if (totalTime >= triggerTimeMs) {
    const finished = await showAskDialog();

    if (finished) return;
  }

  const now = Date.now();
  setTimeout(async () => regularCheck(now), checkInterval);
}

async function showAskDialog(): Promise<boolean> {
  return new Promise<boolean>(async (resolve, _reject) => {
    const descriptionPromise = Promise.resolve('');
    const { content, close } = showInfoboxFromURL(
      'Fill out questionnaire',
      async () => descriptionPromise,
      false,
      () => resolve(true),
    );
    const sel = await content;

    sel.innerHTML = require('html-loader!./html/questionnaire-intro.template.html').default;
    sel.querySelector(':scope button#no-thanks')
      .addEventListener('click', () => {
        close();
        localStorage.setItem(localStorageKeyQuestionnaire, QuestionnaireState.DoNotWant);
        resolve(true);
      });

    sel.querySelector(':scope button#not-now')
      .addEventListener('click', () => {
        close();
        localStorage.setItem(localStorageKeyQuestionnaire, QuestionnaireState.NotYet);
        resolve(true);
      });
    sel.querySelector(':scope button#yes')
      .addEventListener('click', () => {
        close();
        document.querySelector<HTMLAnchorElement>('a#questionnaire-link')?.click();
        resolve(true);
      });
  });
}
