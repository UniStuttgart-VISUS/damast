CREATE USER api LOGIN PASSWORD 'apipassword';
GRANT ALL PRIVILEGES ON DATABASE ocn TO api;

ALTER DEFAULT PRIVILEGES
  GRANT INSERT, UPDATE, DELETE, TRUNCATE, SELECT
  ON TABLES TO api;
ALTER DEFAULT PRIVILEGES
  GRANT USAGE, SELECT, UPDATE
  ON SEQUENCES TO api;
