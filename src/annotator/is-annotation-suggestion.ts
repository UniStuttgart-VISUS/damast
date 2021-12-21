export default function isAnnotationSuggestion({ data }: { data: any }): boolean {
  return 'entity_id' in data;
}
