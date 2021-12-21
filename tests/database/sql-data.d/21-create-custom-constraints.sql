-- Constraint: Annotations' spans should not extend past document length
CREATE FUNCTION check_annotation_document_span_in_document_length(int4range, integer) RETURNS BOOLEAN
AS  'SELECT (((
      CASE
        WHEN lower_inc($1) THEN lower($1)
        ELSE lower($1) + 1
      END
    ) >= 0)
    AND
    ((
      CASE
        WHEN upper_inc($1) THEN upper($1)
        ELSE upper($1) - 1
      END
    ) < (SELECT content_length FROM document WHERE document.id = $2))
    AND lower($1) IS NOT NULL
    AND upper($1) IS NOT NULL
  )'
LANGUAGE 'sql'
WITH     (isstrict);

ALTER TABLE annotation
  ADD CONSTRAINT annotation_document_span_in_document_length
  CHECK (check_annotation_document_span_in_document_length(span, document_id));

ALTER TABLE annotation_suggestion
  ADD CONSTRAINT annotation_suggestion_document_span_in_document_length
  CHECK (check_annotation_document_span_in_document_length(span, document_id));


-- Constraint: An annotation can only be used by one instance (person, place, religion, time_group)
CREATE OR REPLACE FUNCTION check_annotation_only_used_once(integer, integer, integer, integer, integer) RETURNS BOOLEAN
AS  'SELECT
      CASE
        WHEN $1 IS NULL THEN true
        ELSE (
          (SELECT COUNT(*) FROM place_instance WHERE annotation_id = $1 AND id != $2)
        + (SELECT COUNT(*) FROM person_instance WHERE annotation_id = $1 AND id != $3)
        + (SELECT COUNT(*) FROM religion_instance WHERE annotation_id = $1 AND id != $4)
        + (SELECT COUNT(*) FROM time_group WHERE annotation_id = $1 AND id != $5)
        ) = 0
      END
    '
LANGUAGE 'sql'
WITH     (isstrict);

ALTER TABLE place_instance
  ADD CONSTRAINT place_instance__annotation_only_used_once
  CHECK (check_annotation_only_used_once(annotation_id, id, 0, 0, 0));
ALTER TABLE person_instance
  ADD CONSTRAINT person_instance__annotation_only_used_once
  CHECK (check_annotation_only_used_once(annotation_id, 0, id, 0, 0));
ALTER TABLE religion_instance
  ADD CONSTRAINT religion_instance__annotation_only_used_once
  CHECK (check_annotation_only_used_once(annotation_id, 0, 0, id, 0));
ALTER TABLE time_group
  ADD CONSTRAINT time_group__annotation_only_used_once
  CHECK (check_annotation_only_used_once(annotation_id, 0, 0, 0, id));
