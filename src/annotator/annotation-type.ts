import DatabaseAnnotation from './database-annotation';

export default function annotationType(d: DatabaseAnnotation): 'person' | 'place' | 'religion' | 'timegroup' | 'unknown' {
  return (d.person_instance_id !== null)
        ? 'person'
        : (d.place_instance_id !== null)
        ? 'place'
        : (d.religion_instance_id !== null)
        ? 'religion'
        : (d.time_group_id !== null)
        ? 'timegroup'
        : 'unknown';
}


