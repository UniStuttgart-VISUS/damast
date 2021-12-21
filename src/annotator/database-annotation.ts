export default interface DatabaseAnnotation {
  comment: string | null;
  document_id: number;
  evidence_ids: number[] | null;
  id: number;
  person_instance_id: number | null;
  religion_instance_id: number | null;
  place_instance_id: number | null;
  time_group_id: number | null;
  span: [number, number];
};
