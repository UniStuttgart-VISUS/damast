import {
  localStorageKeyUsageTime,
  localStorageKeyReportCount,
} from '../common/questionnaire';
export {};

const form = document.querySelector<HTMLFormElement>('main form');
const button = form.querySelector<HTMLButtonElement>(':scope button[type="submit"]');

function onSubmit(event: MouseEvent) {
  event.preventDefault();

  // handle
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
