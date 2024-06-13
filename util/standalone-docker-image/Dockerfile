FROM continuumio/miniconda3:4.10.3

LABEL maintainer="Max Franke <max@mumintroll.org>"

RUN conda install -c conda-forge cartopy

ENV TZ="Europe/Berlin"
ENV DEBIAN_FRONTEND="noninteractive"

ARG USER_ID
ARG GROUP_ID
ENV USER_ID=1000
ENV GROUP_ID=1000

RUN addgroup --gid $GROUP_ID www
RUN adduser \
      --disabled-password \
      --home /www \
      --gecos '' \
      --uid $USER_ID \
      --gid $GROUP_ID www

RUN apt-get update && apt-get install -y apt-utils build-essential

# configure timezone
RUN ln -fs /usr/share/zoneinfo/Europe/Berlin /etc/localtime && \
  apt-get install -y tzdata

# install xelatex stuff
RUN apt-get install -y \
  texlive-base \
  texlive-xetex \
  texlive-lang-arabic \
  fonts-freefont-ttf \
  fonts-noto-core \
  fontconfig \
  zip

# configure latex
RUN echo 'main_memory = 9000000\nextra_mem_top = 6000000\nextra_mem_bot = 6000000\nhash_extra = 200000\npool_size = 3850000' >> /etc/texmf/web2c/texmf.cnf


# get and install Syriac font
WORKDIR /tmp
RUN wget http://bethmardutho.org/wp-content/uploads/2018/06/melthofonts-1.zip \
  && unzip melthofonts-1.zip \
  && cp melthofonts-1/melthofonts-1.21/SyrCOMTalada.otf /usr/share/fonts/ \
  && fc-cache -f -v \
  && rm -rf melthofonts-1.zip melthofonts-1

# install en_US locale
RUN apt-get install -y locales \
  && echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen \
  && locale-gen

# install postgresql stuff
RUN apt-get install -y postgresql-client postgresql-11 postgresql-11-postgis-2.5

# configure postgresql
RUN mkdir -p /usr/local/pgsql/data
RUN chown -R postgres:postgres /usr/local/pgsql/data
RUN chmod ug+s /usr/local/pgsql/data

RUN su postgres -c "/usr/lib/postgresql/11/bin/initdb -D /usr/local/pgsql/data"

# copy launch scripts
COPY start-postgres-server.sh run.sh start-damast.sh /

# download database dump
RUN wget \
  -O damast-database-dump.sql \
  "https://darus.uni-stuttgart.de/api/access/datafile/:persistentId?persistentId=doi:10.18419/darus-2318/4"
RUN bash -c 'echo -e "80c80a5d656856bf0c1b016bd988f2df\tdamast-database-dump.sql" | md5sum -c -'

# create DB users, Damast DB users, database, load dump
RUN su postgres -c /start-postgres-server.sh \
  && psql -U postgres -h localhost -c "CREATE USER users; CREATE USER api PASSWORD 'apipassword'; CREATE USER ro_dump; CREATE USER damast; GRANT users TO damast;" \
  && psql -U postgres -h localhost -c "CREATE DATABASE ocn;" \
  && psql -U postgres -h localhost -d ocn -f damast-database-dump.sql \
  && psql -U postgres -h localhost -d ocn -c "INSERT INTO users (name, comment) VALUES ('damast', 'default user');"


# install and configure nginx
RUN apt-get install -y nginx curl
# configure nginx with a template so that the port can be changed dynamically
# via the NGINX_PORT and DAMAST_PORT environment variables during "docker run"
COPY nginx_default.conf.template /etc/nginx/templates/default.conf.template

# download shaded relief tiles
COPY download-and-extract-tiles.sh.gz /tmp
RUN zcat /tmp/download-and-extract-tiles.sh.gz | /bin/bash -

# data directory
RUN mkdir /data && chown www:www /data && chmod gu+s /data

# install Python dependencies
USER www

RUN pip install --no-warn-script-location \
  'flask==2.3.2' \
  'gunicorn[gevent]' \
  'requests' \
  'Flask-HTTPAuth' \
  'passlib[bcrypt]' \
  'pyjwt>=2' \
  'pyyaml' \
  'postgres' \
  'password-strength' \
  'brotli' \
  'apscheduler' \
  'html5lib' \
  'jsonschema==3.2.0' \
  'python-dateutil' \
  'beautifulsoup4' \
  'Shapely==1.8a3' \
  'geopandas' \
  'geoplot' \
  'pygeos' \
  'python-Levenshtein'

WORKDIR /

# files
COPY ./damast /damast

ARG DAMAST_PORT
ENV DAMAST_VERSION="v1.3.2"
ENV DAMAST_ENVIRONMENT="PRODUCTION"
ENV DAMAST_PORT="8000"

# copy configuration stuff
ENV DAMAST_CONFIG=/data/damast.config.json
COPY damast.config.json /data/damast.config.json
COPY users_db.sql /tmp
RUN sqlite3 /data/users.db < /tmp/users_db.sql

# cleanup, copy launch scripts
USER root
RUN rm -r /tmp/users_db.sql /tmp/download-and-extract-tiles.sh.gz /tmp/damast-database-dump.sql /tmp/tile-download

CMD /run.sh
