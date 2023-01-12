[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.7403750.svg)](https://doi.org/10.5281/zenodo.7403750)

# Damast

This repository contains code developed for the digital humanities project *"Dhimmis & Muslims &ndash; Analysing Multireligious Spaces in the Medieval Muslim World"*.
The project was funded by the [VolkswagenFoundation](https://portal.volkswagenstiftung.de/search/projectDetails.do?ref=93252) within the scope of the *"Mixed Methods"* initiative.
The project was a collaboration between the Institute for Medieval History II of the Goethe University in Frankfurt/Main, Germany, and the Institute for Visualization and Interactive Systems at the University of Stuttgart, and took place there from 2018 to 2021.

The objective of this joint project was to develop a novel visualization approach in order to gain new insights on the multi-religious landscapes of the Middle East under Muslim rule during the Middle Ages (7th to 14th century).
In particular, information on multi-religious communities were researched and made available in a database accessible through interactive visualization as well as through a pilot web-based geo-temporal multi-view system to analyze and compare information from multiple sources.
A publicly explorable version of the research is available at [Humboldt-Universität zu Berlin](https://damast.geschichte.hu-berlin.de/).
An export of the data collected in the project can be found in [the data repository of the University of Stuttgart (DaRUS)](https://doi.org/10.18419/darus-2318).


## Documentation

All parts of Damast are documented, and this documentation is split over different places, such as:
this and other Markdown files in the repository,
comments in the code and scripts,
and HTML files hosted by Damast itself.
All those documentation parts, as well as a general system description and explanation, are also collected in one LaTeX document in the repository, which is also checked in as a [PDF file](./documentation.pdf).


## Database

The historical data is collected in a relational PostgreSQL database.
For the project, we have used PostgreSQL version 10.
Since the project also deals with geographical data, we additionally use the PostGIS extension.
A suitable database setup is to use the [`postgis/postgis:10-3.1`](https://registry.hub.docker.com/layers/postgis/postgis/10-3.1/images/sha256-e2738cc6a9c6a86e0e5ca0759158839fadb9289459b52e9898b4995e74156131) Docker image.
An SQL script for creating the database schema is located in [`util/postgres/schema.sql`](util/postgres/schema.sql), and in [DaRUS](https://doi.org/10.18419/darus-2318).
An overview of the interplay between tables of the database, and a general explanation, can be found in the [documentation](#documentation).


## Software

The server is programmed in Python using Flask.
Functionalities are split up into a hierarchy of Flask blueprints;
for example, there is a blueprints for the landing page, one for the visualization, and a nested hierarchy of blueprints for the REST API.
The server provides multiple pages, as well as a HTTP interface for reading from and writing to the PostgreSQL database.
The server is built and deployed as a Docker container that contains all necessary dependencies.

An overview and explanation of the different pages and functionalities is provided in the [documentation](#documentation).
The web pages consist of HTML, CSS and JavaScript.
The HTML content is in most cases served via Jinja2 templates that are processed by Flask.
The JavaScript code is compiled from TypeScript source, and the CSS is compiled from SCSS.


## Getting Started

Basic knowledge with build tools and Docker are required.
The instructions below assume a Linux machine with the Bash shell are used.


### Installing Dependencies

On the build system, Docker and NodeJS need to be installed.
If the `Makefile` is used, the `build-essentials` package is required as well.
In the root of the repository, run the following code to install the build dependencies:

``` bash
$ npm install
```


### Building the Frontend

To build all required files for the frontend (JavaScript, CSS, documentation), the `Makefile` can be used, or consulted for the appropriate commands:

``` bash
$ make prod
```

For the web build targets, the `npm` dependencies must have been installed first, see [Installing Dependencies](#Installing-Dependencies).
For the documentation, a LaTeX distribution including `latexmk` and TikZ must be installed on the system.
On a Debian or Ubuntu system, these can be installed via the packages `texlive-pictures` and `latexmk`.


### Building the Docker Image

All frontend content and backend Flask code and contents are bundled within a Docker image.
In that image, the required software dependencies are also installed in the correct versions.
A few configuration options need to be baked into the Docker image on creation, which are dependent on the setup in which the Docker container will later run.
Please refer to the [`deploy.sh`](./deploy.sh) shell script for details and examples, as well as to the section on [running the server](#running-the-server).
The `Dockerfile` is constructed from parts from [`util/docker/`](./util/docker), and then enriched with runtime information to ensure that certain steps are repeated when data changes.
An exemplary creation of a Docker image (fictional values, please refer to [`deploy.sh`](./deploy.sh) before copying) could look as follows:

``` bash
# calculate hash of server files to determine if the COPY instruction should be repeated
$ fs_hash=$(find damast -type f \
    | xargs sha1sum \
    | awk '{print $1}' \
    | sha1sum - \
    | awk '{print $1}')

# assemble Dockerfile
$ cat util/docker/{base,prod}.in \
    | sed "s/@REBUILD_HASH@/$fs_hash/g" \
    > Dockerfile

# build Dockerfile (warning: dummy parameters!)
$ sudo docker build -t damast:latest \
    --build-arg=USER_ID=50 \
    --build-arg=GROUP_ID=50 \
    --build-arg=DAMAST_ENVIRONMENT=PRODUCTION \
    --build-arg=DAMAST_VERSION=v1.0.0 \
    --build-arg=DAMAST_PORT=8000 \
    .
```

The resulting Docker image can then be transferred to the host machine, for example, using `docker save` and `docker load`.
Of course, the image can be built directly on the host machine as well.


### Running the Server

The server infrastructure consists of three components:

 1. The Flask server in its Docker container,
 2. the PostgreSQL database, for example in the form of a `postgis/postgis:10-3.1` Docker container, and
 3. a reverse HTTP proxy on the host machine that handles traffic from the outside and SSL.

The [`util/`](./util/) directory contains configuration templates for an [NGINX reverse proxy](./util/nginx/), [`cron`](./util/crontab), the [start script](./util/run_server.sh.in), the [`systemd` configuration](./util/systemd/), and the [user authentication file](./util/sqlite3-user-file/).
The [documentation](#documentation) also goes into more details about the setup.
A directory on the host machine is mapped as a volume to the `/data` directory in the docker container.
The `/data` directory contains runtime configuration files (`users.db`, `reports.db`, as well as log files).
The main Docker container requires some additional runtime configuration, for example for the PostgreSQL password, which can be passed as environment variables to Docker using the `--env` and `--env-file` flags.
Alternatively, configuration values can be stored in a JSON file in the Docker container's `/data` directory (or any other mounted volume), and the path passed via the `DAMAST_CONFIG` environment variable.
The following configuration environment variables exist, although most have a sensible default:

| Environment Variable | JSON Fieldname | Default Value | Description |
|---|---|---|---|
| `DAMAST_CONFIG` | - |  | JSON file to load configuration from. All other configuration values in this table can be passed via this file as key-value entries in the root object, where the key is the "JSON Fieldname" column of this table. |
| `DAMAST_ENVIRONMENT` | `environment` |  | Server environment (`PRODUCTION`, `TESTING`, or `PYTEST`). This decides with which PostgreSQL database to connect (`ocn`, `testing`, and `pytest` (on Docker container) respectively. This is usually set via the Docker image. |
| `DAMAST_VERSION` | `version` |  | Software version. This is usually set via the Docker image. |
| `DAMAST_USER_FILE` | `user_file` | `/data/users.db` | Path to SQLite3 file with users, passwords, roles. |
| `DAMAST_REPORT_FILE` | `report_file` | `/data/reports.db` | File to which reports are stored during generation. |
| `DAMAST_SECRET_FILE` | `secret_file` |  | File with JWT and app secret keys. These are randomly generated if not passed, but that is impractical for testing with hot reload (user sessions do not persist). For a production server, this should be empty. |
| `DAMAST_PROXYCOUNT` | `proxycount` | `1` | How many reverse proxies the server is behind. This is necessary for proper HTTP redirection and cookie paths. |
| `DAMAST_PROXYPREFIX` | `proxyprefix` | `/` | Reverse proxy prefix. |
| `DAMAST_OVERRIDE_PATH` | `override_path` |  | A directory path under which a `template/` and `static/` directory can be placed. Templates within the `template/` directory will be prioritized over the internal ones. This can be used to provide a different template for a certain page, such as the impressum. |
| `DAMAST_VISITOR_ROLES` | `visitor_roles` |  | If not empty, contains a comma-separated list of roles a visitor (not logged-in) to the site will receive, which in turn governs which pages will be available without user account. If the variable does not exist, visitors will only see public pages. |
| `DAMAST_MAP_STYLES` | `map_styles` |  | If not empty, a relative filename (under `/data`) on the Docker filesystem to a JSON with map styles. These will be used in the Leaflet map. If not provided, the [default styles](./damast/map_styles.py) will be used. See also: [JSON schema](./src/assets/schemas/map-styles.json). |
| `DAMAST_REPORT_EVICTION_DEFERRAL` | `report_eviction_deferral` |  | If not empty, the number of days of not being accessed before a reports' contents (HTML, PDF, map) are *evicted.* Evicted reports can always be regenerated from their state and filter JSON. Eviction happens to save space and improve performance on systems where many reports are anticipated. *This should not be activated on systems with changing databases!* |
| `DAMAST_REPORT_EVICTION_MAXSIZE` | `report_eviction_maxsize` |  | If not empty, the file size in megabytes (MB) of report contents (HTML, PDF, map) above which reports will be evicted. If this is set and the sum of content sizes in the report database *after deferral eviction* is above this number, additional reports are evicted until the sum of sizes is lower than this number. Reports are evicted in ascending order of last access date (the least-recently accessed first). The same rules as above apply. |
| `DAMAST_ANNOTATION_SUGGESTION_REBUILD` | `annotation_suggestion_rebuild` |  | If not empty, the number of days between annotation suggestion rebuilds. In that case, the suggestions are recreated over night every X days. If empty, the annotation suggestions are never recreated, which might be favorable on a system with a static database. |
| `FLASK_ACCESS_LOG` | `access_log` | `/data/access_log` | Path to `access_log` (for logging). |
| `FLASK_ERROR_LOG` | `error_log` | `/data/error_log` | Path to `error_log` (for logging). |
| `DAMAST_PORT` | `port` | `8000` | Port at which `gunicorn` serves the content. **Note:** This is set via the Dockerfile, and also only used in the Dockerfile. |
| `PGHOST` | `pghost` | `localhost` | PostgreSQL hostname. |
| `PGPASSWORD` | `pgpassword` |  | PostgreSQL password. This is important to set and depends on how the database is set up. |
| `PGPORT` | `pgport` | `5432` | PostgreSQL port |
| `PGUSER` | `pguser` | `api` | PostgreSQL user |


Configuration values can be passed in multiple ways.
The precedence of configuration values is as follows (first entry has the highest precedence):

 1. Environment variables passed to the Docker process via the `--env` or `--env-file` flags.
 2. Environment variables baked into the Docker image (see [./util/docker/](the Dockerfile components)).
 3. Configuration entries in the JSON configuration file.
 4. The default value.


#### Overriding Pages

When running the server, it might be necessary to override some pages;
for example, one might want a different home page, or a different impressum.
The server uses the `DAMAST_OVERRIDE_PATH` environment variable to load such overrides.
If it is set, the Flask server creates an extra blueprint, and the directory `${DAMAST_OVERRIDE_PATH}/templates/` is added to the Jinja2 template search path with precedence.
Further, the files in the `${DAMAST_OVERRIDE_PATH}/static/` directory will be served without requiring any authentication under the URL `${DAMAST_PROXYPREFIX}/override/static/<file path>` (use `url_for('override.static', filename='<file path>')` in templates).

An example how this could be used to use an own home page with a separate stylesheet is listed below.
In this example, the `/data` directory in the Docker image is already mapped to the `/www` directory on the host.
In the `/www` directory on the host, we create the directories `override/static/` and `override/templates/`.
Then, we can pass the environment variable `DAMAST_OVERRIDE_PATH` to the Docker container as `/data/override`.

Content of `/www/override/templates/root/index.html`:
``` html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New home page</title>
  <link rel="stylesheet" href="{{ url_for('override.static', filename='home.css') }}">
</head>
<body>
  <h1>This is the new home page</h1>

  <p>
    There is not much content yet.
  </p>
</body>
</html>
```

Content of `/www/override/static/home.css`:
``` css
h1 {
  color: blue;
}
```

Now, when running the server and navigating to `https://<host>/${DAMAST_PROXYPREFIX}/`, the new home page should be served, and the stylesheet loaded.

Keep in mind that all contents of the static directory will be served without user authentication.
For details on which paths templates must be put under for proper override, refer to the `template/` directories of the blueprints in the repository.
For details on how to inherit from the base template, refer to the [base template](./damast/templates/base.html) and other, inheriting templates.
Adding static files while the server is running should work without problems, but templates are not hot-loaded in production systems, so the server needs to be restarted if the templates change.

##### Overriding the Start Page Background Image

To use the default start page, but provide a custom background image visible behind the content, the following instructions must be followed:
The background image can be added as an override static file, or referenced via an external URL.
For the first variant, suppose the image is stored in the override folder in `static/bg.jpg`.
The following contents must then be placed in the override folder in `templates/override/background-image-url.html`:

``` html
<style>
  :root {
    --home-bg-image: url({{ url_for('override.static', filename='bg.jpg') }});
  }
</style>
```

Alternatively, for an external URL, the contents of the `url()` statement would be the URL of the image (e.g., `url(https://example.org/bg.jpg)`).
