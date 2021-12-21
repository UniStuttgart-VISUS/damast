import Cache from '../common/cache';

export default async function confidence_dropdown_values(c: Cache): Promise<{value: string | null, label: string}[]> {
  const cv = await c.confidence;

  return [
    ...cv.map(v => { return { value: v, label: v };}),
    { value: null, label: `<i>no value</i>` }
  ]
}
