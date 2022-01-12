CREATE TABLE users (
  id          TEXT PRIMARY KEY NOT NULL CHECK(id <> 'visitor'),
  password    TEXT,
  expires     DATE,
  roles       TEXT DEFAULT '',
  comment     TEXT DEFAULT NULL
);

