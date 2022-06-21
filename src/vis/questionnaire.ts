import { getConsentCookie } from '../common/cookies';
import { showInfoboxFromURL } from './modal';

const localStorageKeyUsageTime = 'damast-questionnaire.cumulative-usage';
const localStorageKeyQuestionnaire = 'damast-questionnaire.questionnaire';
const checkInterval = 5000;  // XXX
const triggerTimeMs = 15000;//1_800_000  // 30min

enum QuestionnaireState {
  NotYet = 'not yet',
  DoNotWant = 'do not want',
  Done = 'done',
};

export function initQuestionnaire() {
  localStorage.setItem(localStorageKeyUsageTime, '0'); // XXX

  const consentCookie = getConsentCookie();
  if (consentCookie !== 'all') return;

  const now = Date.now();
  setTimeout(async () => regularCheck(now), checkInterval);
}

async function regularCheck(lastTime: number) {
  const timeDelta = Math.floor(Date.now() - lastTime);
  const timeUsed = parseInt(localStorage.getItem(localStorageKeyUsageTime)) ?? 0;
  const totalTime = timeDelta + timeUsed;

  localStorage.setItem(localStorageKeyUsageTime, totalTime.toString());

  const questionnaireState: QuestionnaireState = (localStorage.getItem(localStorageKeyQuestionnaire) ?? QuestionnaireState.NotYet) as QuestionnaireState;
  console.log(questionnaireState);

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
  return new Promise<boolean>(async (resolve, reject) => {
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
        // TODO
        close();
        resolve(false);
      });
  });
}
