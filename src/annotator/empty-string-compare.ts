export default function compare(a: string | null, b: string | null) {
  if (a === null && b === '' || a === '' && b === null) return true;
  return a === b;
}
