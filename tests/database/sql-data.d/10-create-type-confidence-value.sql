\connect ocn

--
-- Name: confidence_value; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.confidence_value AS ENUM (
    'false',
    'uncertain',
    'contested',
    'probable',
    'certain'
);


ALTER TYPE public.confidence_value OWNER TO docker;
