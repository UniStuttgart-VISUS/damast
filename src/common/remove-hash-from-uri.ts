export default function removeHash() {
  const uri = window.location.toString();
  const clean = uri.substring(0, uri.indexOf('#'));
  window.history.replaceState({}, document.title, clean);
}
