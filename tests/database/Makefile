imagename = dhimmis-pytest-testdb

# these tables are generated
generated_tables =
generated_tables += 40-action_type
generated_tables += 42-annotation
generated_tables += 47-document
generated_tables += 48-evidence
generated_tables += 49-language
generated_tables += 50-name_var
generated_tables += 55-place
generated_tables += 56-place_instance
generated_tables += 58-place_type
generated_tables += 61-religion
generated_tables += 62-religion_instance
generated_tables += 67-time_group
generated_tables += 68-time_instance
generated_tables += 52-person
generated_tables += 53-person_instance
generated_tables += 54-person_type
generated_tables += 64-source
generated_tables += 65-source_instance
generated_tables += 66-source_type
generated_tables += 69-user_action
generated_tables += 70-tag
generated_tables += 71-tag_evidence
generated_tables += 72-external_database
generated_tables += 73-uri_namespace
generated_tables += 74-external_place_uri
generated_tables += 75-external_person_uri


generated_sql = $(addprefix sql-data.d/,$(addsuffix -data.generated.sql, $(generated_tables)))

.PHONY: all

all: $(imagename)

$(imagename): sql-data.d/*.sql sql-data.d/30-create-dhimmis-users.sql $(generated_sql) Dockerfile
	docker build -t $@ .

sql-data.d/30-create-dhimmis-users.sql: ../testusers.yaml
	./create_users.py $< > $@

$(generated_sql): $(generated_tables)

$(generated_tables): FORCE
	python3 testdata.py $@

Dockerfile: sql-data.d/30-create-dhimmis-users.sql $(generated_sql)
	hash=$$(sha1sum sql-data.d/* \
		| awk '{print $$1}' \
		| sha1sum - \
		| awk '{print $$1}') && \
	sed "s|^#include_rebuild_hash|RUN /bin/true $$hash|" Dockerfile.in > $@

FORCE: ;
