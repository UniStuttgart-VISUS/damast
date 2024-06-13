CREATE TABLE users (
  id          TEXT PRIMARY KEY NOT NULL CHECK(id <> 'visitor'),
  password    TEXT NOT NULL,
  expires     DATE DEFAULT NULL,
  roles       TEXT NOT NULL DEFAULT '',
  comment     TEXT DEFAULT NULL
);

INSERT INTO users VALUES (
  'damast',
  '$5$rounds=535000$FjT0JOkRfzFieD/E$E7dz20Q9S6H2xjCizWaCg//JWep0O0HZBeprkLlEfe8',
  NULL,
  'user,dev,annotator,vis,geodb,reporting,readdb,writedb',
  'default user, password "damast"'
)