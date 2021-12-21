CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  password    TEXT,
  expires     DATE,
  roles       TEXT DEFAULT '',
  comment     TEXT DEFAULT NULL
);

