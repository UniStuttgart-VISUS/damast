CREATE TABLE users (
  id          TEXT PRIMARY KEY NOT NULL CHECK(id <> 'visitor'),
  password    TEXT NOT NULL,
  expires     DATE DEFAULT NULL,
  roles       TEXT NOT NULL DEFAULT '',
  comment     TEXT DEFAULT NULL
);

