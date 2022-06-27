import { getConsentCookie } from '../common/cookies';
import {
  localStorageKeyUsageTime,
  localStorageKeyQuestionnaire,
  localStorageKeyReportCount,
  QuestionnaireState
} from '../common/questionnaire';
export {};

const form = document.querySelector<HTMLFormElement>('main form');
const button = form.querySelector<HTMLButtonElement>(':scope button[type="submit"]');

function onSubmit(event: MouseEvent) {
  event.preventDefault();

  // handle
  const ck = getConsentCookie();
  if (ck === 'essential' || ck === 'all') {
    localStorage.setItem(localStorageKeyQuestionnaire, QuestionnaireState.Done);
  }
  form.querySelector<HTMLInputElement>(':scope input[name="usage-time"]')?.setAttribute(
    'value',
    localStorage.getItem(localStorageKeyUsageTime) ?? '<unknown>'
  );
  form.querySelector<HTMLInputElement>(':scope input[name="number-reports-generated"]')?.setAttribute(
    'value',
    localStorage.getItem(localStorageKeyReportCount) ?? '<unknown>'
  );

  form.submit();
}

button.addEventListener('click', onSubmit);
