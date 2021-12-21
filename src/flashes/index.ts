export {};

// get all flashes
const flashWindows = document.querySelectorAll('li.flash');
flashWindows.forEach(node => {
  const closeButton = node.querySelector(':scope button.flash__close');
  const closeTimeout = parseInt(node.getAttribute('data-timeout') || '2000');

  const close = () => {node.parentElement.removeChild(node)};

  const timeoutId = setTimeout(close, closeTimeout);
  closeButton.addEventListener('click', () => {
    clearTimeout(timeoutId);
    close();
  });
});
