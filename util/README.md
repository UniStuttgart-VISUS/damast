# Utilities

This directory contains utilities for setting up and running the Damast system.


## PostgreSQL Database

The [`postgres/`](./postgres/) directory contains a SQL file for creating the database schema.
On the PostgreSQL server, there should be the following roles:

 1. The default `postgres` admin role,
 2. a `users` role which can be `GRANT`ed to all users that need to connect to the database,
 3. an `api` role, which the Flask server will use to connect to the database, and
 4. a read-only `pg_dump` role, which is used for backups.

The directory also contains an exemplary backup script, which can be used in combination with a `cron` job to create daily/weekly/... backups.


## User file

The [`sqlite3-user-file`](./sqlite3-user-file/) directory contains a SQL schema of the user file, which is used to define which users exist, when they expire, which password they have, and what roles they are part of.
See [the roles documentation](../docs/roles.md) for more information.
The directory also contains a Python script for user management.


## Map for Reports

For the reports, a vector map is required.
The processed file is checked in, and can be found [here](../damast/reporting/map-data/features.geo.json.gz).
However, the map can also be recreated from the NaturalEarth data using the files in the [`report-map`](./report-map/) directory.


## Docker Image

The Damast server can be deployed as a singular Docker image.
This is done via the [deploy script](../deploy.sh) in the root of the repository, which in turn processes the contents of the [`docker`](./docker/) directory to create a Dockerfile.
This directory contains the base image definition, the additions for the Damast image, and the additions for a local test server.


## Runtime Files

Additional files here are for the configuration and maintenance of the host system where the Damast instance is running:

 - The [`systemd`](./systemd/) directory contains the `systemd` service files for running the service.
 - The [`nginx`](./nginx/) directory contains the drop-in configuration for an NGINX reverse proxy server, as well as a fallback page to be shown if the Damast server is not responding.
 - The `run_server.sh.in` is preprocessed by the [deploy script](../deploy.sh) and copied to the host. It is called by the `systemd` service to start the Damast instance.
 - The `list_reports.py` file is a script to show all reports in the *report database.*
 - The `logstat.awk` is an `awk` script to get some statistics about usage from the server logs (`access_log*`).
 - The `crontab` should be installed on the host system to ensure that server logs are removed after 10 days. This is necessary for GDPR compliance, but the specific time can be changed if the GDPR statement is changed accordingly.
