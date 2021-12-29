--
-- PostgreSQL database dump
--

-- Dumped from database version 10.18 (Debian 10.18-1.pgdg110+1)
-- Dumped by pg_dump version 13.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ocn; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE ocn WITH TEMPLATE = template0 ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.utf8';


ALTER DATABASE ocn OWNER TO postgres;

\connect ocn

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ocn; Type: DATABASE PROPERTIES; Schema: -; Owner: postgres
--

ALTER DATABASE ocn SET search_path TO '$user', 'public', 'topology';


\connect ocn

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO postgres;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry, geography, and raster spatial types and functions';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


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


ALTER TYPE public.confidence_value OWNER TO postgres;

--
-- Name: check_annotation_document_span_in_document_length(int4range, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_annotation_document_span_in_document_length(int4range, integer) RETURNS boolean
    LANGUAGE sql STRICT
    AS $_$SELECT (((
      CASE
        WHEN lower_inc($1) THEN lower($1)
        ELSE lower($1) + 1
      END
    ) >= 0)
    AND
    ((
      CASE
        WHEN upper_inc($1) THEN upper($1)
        ELSE upper($1) - 1
      END
    ) < (SELECT content_length FROM document WHERE document.id = $2))
    AND lower($1) IS NOT NULL
    AND upper($1) IS NOT NULL
  )$_$;


ALTER FUNCTION public.check_annotation_document_span_in_document_length(int4range, integer) OWNER TO postgres;

--
-- Name: check_annotation_only_used_once(integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_annotation_only_used_once(integer, integer, integer, integer, integer) RETURNS boolean
    LANGUAGE sql STRICT
    AS $_$SELECT
      CASE
        WHEN $1 IS NULL THEN true
        WHEN (SELECT COUNT(*) FROM place_instance WHERE annotation_id = $1 AND id != $2) > 0 THEN false
        WHEN (SELECT COUNT(*) FROM person_instance WHERE annotation_id = $1 AND id != $3) > 0 THEN false
        WHEN (SELECT COUNT(*) FROM religion_instance WHERE annotation_id = $1 AND id != $4) > 0 THEN false
        WHEN (SELECT COUNT(*) FROM time_group WHERE annotation_id = $1 AND id != $5) > 0 THEN false
        ELSE true
      END
    $_$;


ALTER FUNCTION public.check_annotation_only_used_once(integer, integer, integer, integer, integer) OWNER TO postgres;

SET default_tablespace = '';

--
-- Name: action_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.action_type (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.action_type OWNER TO postgres;

--
-- Name: action_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.action_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.action_type_id_seq OWNER TO postgres;

--
-- Name: action_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.action_type_id_seq OWNED BY public.action_type.id;


--
-- Name: annotation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.annotation (
    id integer NOT NULL,
    document_id integer NOT NULL,
    span int4range NOT NULL,
    comment text,
    CONSTRAINT annotation_document_span_in_document_length CHECK (public.check_annotation_document_span_in_document_length(span, document_id))
);


ALTER TABLE public.annotation OWNER TO postgres;

--
-- Name: annotation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.annotation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.annotation_id_seq OWNER TO postgres;

--
-- Name: annotation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.annotation_id_seq OWNED BY public.annotation.id;


--
-- Name: evidence; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence (
    id integer NOT NULL,
    time_group_id integer,
    place_instance_id integer,
    religion_instance_id integer,
    person_instance_id integer,
    interpretation_confidence public.confidence_value,
    visible boolean NOT NULL,
    comment text
);


ALTER TABLE public.evidence OWNER TO postgres;

--
-- Name: person_instance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_instance (
    id integer NOT NULL,
    person_id integer NOT NULL,
    annotation_id integer,
    confidence public.confidence_value,
    comment text,
    CONSTRAINT person_instance__annotation_only_used_once CHECK (public.check_annotation_only_used_once(annotation_id, 0, id, 0, 0))
);


ALTER TABLE public.person_instance OWNER TO postgres;

--
-- Name: place_instance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_instance (
    id integer NOT NULL,
    place_id integer NOT NULL,
    annotation_id integer,
    confidence public.confidence_value,
    comment text,
    CONSTRAINT place_instance__annotation_only_used_once CHECK (public.check_annotation_only_used_once(annotation_id, id, 0, 0, 0))
);


ALTER TABLE public.place_instance OWNER TO postgres;

--
-- Name: religion_instance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.religion_instance (
    id integer NOT NULL,
    religion_id integer NOT NULL,
    annotation_id integer,
    confidence public.confidence_value,
    comment text,
    CONSTRAINT religion_instance__annotation_only_used_once CHECK (public.check_annotation_only_used_once(annotation_id, 0, 0, id, 0))
);


ALTER TABLE public.religion_instance OWNER TO postgres;

--
-- Name: time_group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_group (
    id integer NOT NULL,
    annotation_id integer,
    CONSTRAINT time_group__annotation_only_used_once CHECK (public.check_annotation_only_used_once(annotation_id, 0, 0, 0, id))
);


ALTER TABLE public.time_group OWNER TO postgres;

--
-- Name: annotation_overview; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.annotation_overview AS
 SELECT a.id,
    a.document_id,
    a.span,
    a.comment,
    pi.id AS place_instance_id,
    p.id AS person_instance_id,
    ri.id AS religion_instance_id,
    tg.id AS time_group_id,
    ( SELECT array_agg(e.id) AS array_agg
           FROM public.evidence e
          WHERE ((e.place_instance_id = pi.id) OR (e.religion_instance_id = ri.id) OR (e.person_instance_id = p.id) OR (e.time_group_id = tg.id))) AS evidence_ids
   FROM ((((public.annotation a
     LEFT JOIN public.place_instance pi ON ((pi.annotation_id = a.id)))
     LEFT JOIN public.person_instance p ON ((p.annotation_id = a.id)))
     LEFT JOIN public.religion_instance ri ON ((ri.annotation_id = a.id)))
     LEFT JOIN public.time_group tg ON ((tg.annotation_id = a.id)));


ALTER TABLE public.annotation_overview OWNER TO postgres;

--
-- Name: annotation_suggestion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.annotation_suggestion (
    id integer NOT NULL,
    document_id integer NOT NULL,
    span int4range NOT NULL,
    source text[] NOT NULL,
    type text NOT NULL,
    entity_id integer NOT NULL,
    CONSTRAINT annotation_suggestion_document_span_in_document_length CHECK (public.check_annotation_document_span_in_document_length(span, document_id))
);


ALTER TABLE public.annotation_suggestion OWNER TO postgres;

--
-- Name: annotation_suggestion_document_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.annotation_suggestion_document_state (
    document_id integer NOT NULL,
    suggestion_hash text NOT NULL
);


ALTER TABLE public.annotation_suggestion_document_state OWNER TO postgres;

--
-- Name: annotation_suggestion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.annotation_suggestion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.annotation_suggestion_id_seq OWNER TO postgres;

--
-- Name: annotation_suggestion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.annotation_suggestion_id_seq OWNED BY public.annotation_suggestion.id;


--
-- Name: document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document (
    id integer NOT NULL,
    source_id integer NOT NULL,
    version integer NOT NULL,
    comment text,
    content_type text NOT NULL,
    content bytea NOT NULL,
    content_length integer NOT NULL
);


ALTER TABLE public.document OWNER TO postgres;

--
-- Name: document_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.document_id_seq OWNER TO postgres;

--
-- Name: document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_id_seq OWNED BY public.document.id;


--
-- Name: evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.evidence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.evidence_id_seq OWNER TO postgres;

--
-- Name: evidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.evidence_id_seq OWNED BY public.evidence.id;


--
-- Name: external_database_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.external_database_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.external_database_id_seq OWNER TO postgres;

--
-- Name: external_database; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_database (
    id integer DEFAULT nextval('public.external_database_id_seq'::regclass) NOT NULL,
    name text NOT NULL,
    short_name text NOT NULL,
    url text,
    comment text
);


ALTER TABLE public.external_database OWNER TO postgres;

--
-- Name: external_person_uri_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.external_person_uri_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.external_person_uri_id_seq OWNER TO postgres;

--
-- Name: external_person_uri; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_person_uri (
    id integer DEFAULT nextval('public.external_person_uri_id_seq'::regclass) NOT NULL,
    person_id integer NOT NULL,
    uri_namespace_id integer NOT NULL,
    uri_fragment text NOT NULL,
    comment text
);


ALTER TABLE public.external_person_uri OWNER TO postgres;

--
-- Name: external_place_uri_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.external_place_uri_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.external_place_uri_id_seq OWNER TO postgres;

--
-- Name: external_place_uri; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_place_uri (
    id integer DEFAULT nextval('public.external_place_uri_id_seq'::regclass) NOT NULL,
    place_id integer NOT NULL,
    uri_namespace_id integer NOT NULL,
    uri_fragment text NOT NULL,
    comment text
);


ALTER TABLE public.external_place_uri OWNER TO postgres;

--
-- Name: language; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.language (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.language OWNER TO postgres;

--
-- Name: language_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.language_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.language_id_seq OWNER TO postgres;

--
-- Name: language_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.language_id_seq OWNED BY public.language.id;


--
-- Name: name_var; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.name_var (
    id integer NOT NULL,
    name text NOT NULL,
    transcription text,
    simplified text,
    main_form boolean NOT NULL,
    comment text,
    place_id integer NOT NULL,
    language_id integer NOT NULL
);


ALTER TABLE public.name_var OWNER TO postgres;

--
-- Name: name_var_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.name_var_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.name_var_id_seq OWNER TO postgres;

--
-- Name: name_var_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.name_var_id_seq OWNED BY public.name_var.id;


--
-- Name: person; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person (
    id integer NOT NULL,
    name text NOT NULL,
    comment text,
    person_type integer NOT NULL,
    time_range text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.person OWNER TO postgres;

--
-- Name: person_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.person_id_seq OWNER TO postgres;

--
-- Name: person_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_id_seq OWNED BY public.person.id;


--
-- Name: person_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.person_instance_id_seq OWNER TO postgres;

--
-- Name: person_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_instance_id_seq OWNED BY public.person_instance.id;


--
-- Name: person_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_type (
    id integer NOT NULL,
    type text NOT NULL
);


ALTER TABLE public.person_type OWNER TO postgres;

--
-- Name: person_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.person_type_id_seq OWNER TO postgres;

--
-- Name: person_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_type_id_seq OWNED BY public.person_type.id;


--
-- Name: place; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place (
    id integer NOT NULL,
    name text NOT NULL,
    comment text,
    geoloc point,
    confidence public.confidence_value,
    visible boolean,
    place_type_id integer NOT NULL
);


ALTER TABLE public.place OWNER TO postgres;

--
-- Name: place_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.place_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_id_seq OWNER TO postgres;

--
-- Name: place_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.place_id_seq OWNED BY public.place.id;


--
-- Name: place_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.place_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_instance_id_seq OWNER TO postgres;

--
-- Name: place_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.place_instance_id_seq OWNED BY public.place_instance.id;


--
-- Name: place_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_type (
    id integer NOT NULL,
    type text NOT NULL,
    visible boolean DEFAULT true NOT NULL
);


ALTER TABLE public.place_type OWNER TO postgres;

--
-- Name: place_overview; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.place_overview AS
 SELECT place.id,
    place.name,
    place.geoloc,
    place.confidence AS location_confidence,
    place_type.type AS place_type
   FROM (public.place
     JOIN public.place_type ON ((place.place_type_id = place_type.id)))
  WHERE (place.visible AND place_type.visible)
  ORDER BY place.id;


ALTER TABLE public.place_overview OWNER TO postgres;

--
-- Name: source_instance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.source_instance (
    id integer NOT NULL,
    source_id integer NOT NULL,
    evidence_id integer NOT NULL,
    source_page text,
    source_confidence public.confidence_value,
    comment text
);


ALTER TABLE public.source_instance OWNER TO postgres;

--
-- Name: time_instance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_instance (
    id integer NOT NULL,
    time_group_id integer NOT NULL,
    span int4range,
    confidence public.confidence_value,
    comment text
);


ALTER TABLE public.time_instance OWNER TO postgres;

--
-- Name: place_religion_overview; Type: MATERIALIZED VIEW; Schema: public; Owner: api
--

CREATE MATERIALIZED VIEW public.place_religion_overview AS
 SELECT evidence.id AS tuple_id,
    place_instance.place_id,
    time_instance.span AS time_span,
    religion_instance.religion_id,
    ( SELECT array_to_json(array_agg(source_instance.source_id)) AS array_to_json
           FROM public.source_instance
          WHERE (source_instance.evidence_id = evidence.id)) AS source_ids,
    time_instance.confidence AS time_confidence,
    place.confidence AS location_confidence,
    place_instance.confidence AS place_attribution_confidence,
    ( SELECT array_to_json(array_agg(source_instance.source_confidence)) AS array_to_json
           FROM public.source_instance
          WHERE (source_instance.evidence_id = evidence.id)) AS source_confidences,
    evidence.interpretation_confidence,
    religion_instance.confidence AS religion_confidence
   FROM ((((((public.evidence
     LEFT JOIN public.religion_instance ON ((evidence.religion_instance_id = religion_instance.id)))
     LEFT JOIN public.place_instance ON ((evidence.place_instance_id = place_instance.id)))
     LEFT JOIN public.time_group ON ((evidence.time_group_id = time_group.id)))
     LEFT JOIN public.time_instance ON ((time_instance.time_group_id = time_group.id)))
     JOIN public.place ON ((place_instance.place_id = place.id)))
     JOIN public.place_type ON ((place.place_type_id = place_type.id)))
  WHERE (evidence.visible AND place.visible AND place_type.visible)
  ORDER BY evidence.id
  WITH NO DATA;


ALTER TABLE public.place_religion_overview OWNER TO api;

--
-- Name: place_set; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_set (
    uuid uuid NOT NULL,
    description text NOT NULL,
    filter integer[] NOT NULL,
    date text NOT NULL,
    username text NOT NULL
);


ALTER TABLE public.place_set OWNER TO postgres;

--
-- Name: place_time_range; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_time_range (
    id integer NOT NULL,
    place_id integer NOT NULL,
    time_start integer NOT NULL,
    time_end integer NOT NULL
);


ALTER TABLE public.place_time_range OWNER TO postgres;

--
-- Name: place_time_range_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.place_time_range_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_time_range_id_seq OWNER TO postgres;

--
-- Name: place_time_range_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.place_time_range_id_seq OWNED BY public.place_time_range.id;


--
-- Name: place_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.place_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_type_id_seq OWNER TO postgres;

--
-- Name: place_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.place_type_id_seq OWNED BY public.place_type.id;


--
-- Name: religion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.religion (
    id integer NOT NULL,
    name text NOT NULL,
    abbreviation text NOT NULL,
    color text NOT NULL,
    parent_id integer
);


ALTER TABLE public.religion OWNER TO postgres;

--
-- Name: religion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.religion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.religion_id_seq OWNER TO postgres;

--
-- Name: religion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.religion_id_seq OWNED BY public.religion.id;


--
-- Name: religion_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.religion_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.religion_instance_id_seq OWNER TO postgres;

--
-- Name: religion_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.religion_instance_id_seq OWNED BY public.religion_instance.id;


--
-- Name: religions_per_place; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.religions_per_place AS
 SELECT place.id AS place_id,
    ARRAY( SELECT DISTINCT religion_instance.religion_id
           FROM ((( SELECT place_instance.id,
                    place_instance.place_id,
                    place_instance.annotation_id,
                    place_instance.confidence,
                    place_instance.comment
                   FROM public.place_instance
                  WHERE (place_instance.place_id = place.id)) pi
             LEFT JOIN public.evidence ON ((evidence.place_instance_id = pi.id)))
             LEFT JOIN public.religion_instance ON ((evidence.religion_instance_id = religion_instance.id)))
          WHERE evidence.visible
          ORDER BY religion_instance.religion_id) AS religion_ids
   FROM (public.place
     JOIN public.place_type ON ((place.place_type_id = place_type.id)))
  WHERE (place.visible AND place_type.visible);


ALTER TABLE public.religions_per_place OWNER TO postgres;

--
-- Name: source; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.source (
    id integer NOT NULL,
    name text NOT NULL,
    source_type_id integer NOT NULL,
    default_confidence public.confidence_value,
    short text NOT NULL
);


ALTER TABLE public.source OWNER TO postgres;

--
-- Name: source_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.source_id_seq OWNER TO postgres;

--
-- Name: source_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.source_id_seq OWNED BY public.source.id;


--
-- Name: source_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.source_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.source_instance_id_seq OWNER TO postgres;

--
-- Name: source_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.source_instance_id_seq OWNED BY public.source_instance.id;


--
-- Name: source_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.source_type (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.source_type OWNER TO postgres;

--
-- Name: source_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.source_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.source_type_id_seq OWNER TO postgres;

--
-- Name: source_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.source_type_id_seq OWNED BY public.source_type.id;


--
-- Name: tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag (
    id integer NOT NULL,
    tagname text NOT NULL,
    comment text
);


ALTER TABLE public.tag OWNER TO postgres;

--
-- Name: tag_evidence; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag_evidence (
    id integer NOT NULL,
    tag_id integer NOT NULL,
    evidence_id integer NOT NULL
);


ALTER TABLE public.tag_evidence OWNER TO postgres;

--
-- Name: tag_evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tag_evidence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tag_evidence_id_seq OWNER TO postgres;

--
-- Name: tag_evidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tag_evidence_id_seq OWNED BY public.tag_evidence.id;


--
-- Name: tag_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tag_id_seq OWNER TO postgres;

--
-- Name: tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tag_id_seq OWNED BY public.tag.id;


--
-- Name: time_group_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.time_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.time_group_id_seq OWNER TO postgres;

--
-- Name: time_group_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.time_group_id_seq OWNED BY public.time_group.id;


--
-- Name: time_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.time_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.time_instance_id_seq OWNER TO postgres;

--
-- Name: time_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.time_instance_id_seq OWNED BY public.time_instance.id;


--
-- Name: uri_namespace_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.uri_namespace_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.uri_namespace_id_seq OWNER TO postgres;

--
-- Name: uri_namespace; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uri_namespace (
    id integer DEFAULT nextval('public.uri_namespace_id_seq'::regclass) NOT NULL,
    external_database_id integer NOT NULL,
    uri_pattern text NOT NULL,
    short_name text NOT NULL,
    comment text
);


ALTER TABLE public.uri_namespace OWNER TO postgres;

--
-- Name: user_action; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_action (
    id integer NOT NULL,
    evidence_id integer,
    action_type_id integer NOT NULL,
    user_id integer NOT NULL,
    "timestamp" timestamp with time zone,
    description text NOT NULL,
    old_value json,
    comment text
);


ALTER TABLE public.user_action OWNER TO postgres;

--
-- Name: user_action_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_action_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_action_id_seq OWNER TO postgres;

--
-- Name: user_action_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_action_id_seq OWNED BY public.user_action.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    comment text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: action_type id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.action_type ALTER COLUMN id SET DEFAULT nextval('public.action_type_id_seq'::regclass);


--
-- Name: annotation id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation ALTER COLUMN id SET DEFAULT nextval('public.annotation_id_seq'::regclass);


--
-- Name: annotation_suggestion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation_suggestion ALTER COLUMN id SET DEFAULT nextval('public.annotation_suggestion_id_seq'::regclass);


--
-- Name: document id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document ALTER COLUMN id SET DEFAULT nextval('public.document_id_seq'::regclass);


--
-- Name: evidence id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence ALTER COLUMN id SET DEFAULT nextval('public.evidence_id_seq'::regclass);


--
-- Name: language id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.language ALTER COLUMN id SET DEFAULT nextval('public.language_id_seq'::regclass);


--
-- Name: name_var id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.name_var ALTER COLUMN id SET DEFAULT nextval('public.name_var_id_seq'::regclass);


--
-- Name: person id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person ALTER COLUMN id SET DEFAULT nextval('public.person_id_seq'::regclass);


--
-- Name: person_instance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_instance ALTER COLUMN id SET DEFAULT nextval('public.person_instance_id_seq'::regclass);


--
-- Name: person_type id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_type ALTER COLUMN id SET DEFAULT nextval('public.person_type_id_seq'::regclass);


--
-- Name: place id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place ALTER COLUMN id SET DEFAULT nextval('public.place_id_seq'::regclass);


--
-- Name: place_instance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_instance ALTER COLUMN id SET DEFAULT nextval('public.place_instance_id_seq'::regclass);


--
-- Name: place_time_range id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_time_range ALTER COLUMN id SET DEFAULT nextval('public.place_time_range_id_seq'::regclass);


--
-- Name: place_type id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_type ALTER COLUMN id SET DEFAULT nextval('public.place_type_id_seq'::regclass);


--
-- Name: religion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.religion ALTER COLUMN id SET DEFAULT nextval('public.religion_id_seq'::regclass);


--
-- Name: religion_instance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.religion_instance ALTER COLUMN id SET DEFAULT nextval('public.religion_instance_id_seq'::regclass);


--
-- Name: source id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source ALTER COLUMN id SET DEFAULT nextval('public.source_id_seq'::regclass);


--
-- Name: source_instance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_instance ALTER COLUMN id SET DEFAULT nextval('public.source_instance_id_seq'::regclass);


--
-- Name: source_type id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_type ALTER COLUMN id SET DEFAULT nextval('public.source_type_id_seq'::regclass);


--
-- Name: tag id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag ALTER COLUMN id SET DEFAULT nextval('public.tag_id_seq'::regclass);


--
-- Name: tag_evidence id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_evidence ALTER COLUMN id SET DEFAULT nextval('public.tag_evidence_id_seq'::regclass);


--
-- Name: time_group id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_group ALTER COLUMN id SET DEFAULT nextval('public.time_group_id_seq'::regclass);


--
-- Name: time_instance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_instance ALTER COLUMN id SET DEFAULT nextval('public.time_instance_id_seq'::regclass);


--
-- Name: user_action id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action ALTER COLUMN id SET DEFAULT nextval('public.user_action_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: action_type action_type_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.action_type
    ADD CONSTRAINT action_type_name_key UNIQUE (name);


--
-- Name: action_type action_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.action_type
    ADD CONSTRAINT action_type_pkey PRIMARY KEY (id);


--
-- Name: annotation annotation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation
    ADD CONSTRAINT annotation_pkey PRIMARY KEY (id);


--
-- Name: annotation_suggestion_document_state annotation_suggestion_document_state_document_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation_suggestion_document_state
    ADD CONSTRAINT annotation_suggestion_document_state_document_id_key UNIQUE (document_id);


--
-- Name: annotation_suggestion annotation_suggestion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation_suggestion
    ADD CONSTRAINT annotation_suggestion_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_pkey PRIMARY KEY (id);


--
-- Name: external_database external_database__short_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_database
    ADD CONSTRAINT external_database__short_name_unique UNIQUE (short_name);


--
-- Name: external_database external_database_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_database
    ADD CONSTRAINT external_database_pkey PRIMARY KEY (id);


--
-- Name: external_person_uri external_person_uri_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_person_uri
    ADD CONSTRAINT external_person_uri_pkey PRIMARY KEY (id);


--
-- Name: external_place_uri external_place_uri_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_place_uri
    ADD CONSTRAINT external_place_uri_pkey PRIMARY KEY (id);


--
-- Name: language language_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.language
    ADD CONSTRAINT language_pkey PRIMARY KEY (id);


--
-- Name: name_var name_var_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.name_var
    ADD CONSTRAINT name_var_pkey PRIMARY KEY (id);


--
-- Name: person person__name__time_range__unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person__name__time_range__unique UNIQUE (name, time_range);


--
-- Name: person_instance person_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_instance
    ADD CONSTRAINT person_instance_pkey PRIMARY KEY (id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);


--
-- Name: person_type person_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_type
    ADD CONSTRAINT person_type_pkey PRIMARY KEY (id);


--
-- Name: place_instance place_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_instance
    ADD CONSTRAINT place_instance_pkey PRIMARY KEY (id);


--
-- Name: place place_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place
    ADD CONSTRAINT place_name_key UNIQUE (name);


--
-- Name: place place_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place
    ADD CONSTRAINT place_pkey PRIMARY KEY (id);


--
-- Name: place_set place_set_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_set
    ADD CONSTRAINT place_set_uuid_key UNIQUE (uuid);


--
-- Name: place_time_range place_time_range_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_time_range
    ADD CONSTRAINT place_time_range_pkey PRIMARY KEY (id);


--
-- Name: place_type place_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_type
    ADD CONSTRAINT place_type_pkey PRIMARY KEY (id);


--
-- Name: religion_instance religion_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.religion_instance
    ADD CONSTRAINT religion_instance_pkey PRIMARY KEY (id);


--
-- Name: religion religion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.religion
    ADD CONSTRAINT religion_pkey PRIMARY KEY (id);


--
-- Name: source_instance source_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_instance
    ADD CONSTRAINT source_instance_pkey PRIMARY KEY (id);


--
-- Name: source source_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_pkey PRIMARY KEY (id);


--
-- Name: source source_short_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_short_key UNIQUE (short);


--
-- Name: source_type source_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_type
    ADD CONSTRAINT source_type_pkey PRIMARY KEY (id);


--
-- Name: tag_evidence tag_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_pkey PRIMARY KEY (id);


--
-- Name: tag_evidence tag_evidence_tag_id_evidence_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_tag_id_evidence_id_key UNIQUE (tag_id, evidence_id);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: tag tag_tagname_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_tagname_key UNIQUE (tagname);


--
-- Name: time_group time_group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_group
    ADD CONSTRAINT time_group_pkey PRIMARY KEY (id);


--
-- Name: time_instance time_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_instance
    ADD CONSTRAINT time_instance_pkey PRIMARY KEY (id);


--
-- Name: uri_namespace uri_namespace_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uri_namespace
    ADD CONSTRAINT uri_namespace_pkey PRIMARY KEY (id);


--
-- Name: user_action user_action_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_pkey PRIMARY KEY (id);


--
-- Name: users users_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_name_key UNIQUE (name);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: annotation annotation_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation
    ADD CONSTRAINT annotation_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: annotation_suggestion annotation_suggestion_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation_suggestion
    ADD CONSTRAINT annotation_suggestion_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: annotation_suggestion_document_state annotation_suggestion_document_state_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.annotation_suggestion_document_state
    ADD CONSTRAINT annotation_suggestion_document_state_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document document_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.source(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: evidence evidence_person_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_person_instance_id_fkey FOREIGN KEY (person_instance_id) REFERENCES public.person_instance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evidence evidence_place_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_place_instance_id_fkey FOREIGN KEY (place_instance_id) REFERENCES public.place_instance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evidence evidence_religion_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_religion_instance_id_fkey FOREIGN KEY (religion_instance_id) REFERENCES public.religion_instance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evidence evidence_time_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_time_group_id_fkey FOREIGN KEY (time_group_id) REFERENCES public.time_group(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: external_person_uri external_person_uri_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_person_uri
    ADD CONSTRAINT external_person_uri_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_person_uri external_person_uri_uri_namespace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_person_uri
    ADD CONSTRAINT external_person_uri_uri_namespace_id_fkey FOREIGN KEY (uri_namespace_id) REFERENCES public.uri_namespace(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_place_uri external_place_uri_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_place_uri
    ADD CONSTRAINT external_place_uri_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_place_uri external_place_uri_uri_namespace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_place_uri
    ADD CONSTRAINT external_place_uri_uri_namespace_id_fkey FOREIGN KEY (uri_namespace_id) REFERENCES public.uri_namespace(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: name_var name_var_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.name_var
    ADD CONSTRAINT name_var_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.language(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: name_var name_var_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.name_var
    ADD CONSTRAINT name_var_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: person_instance person_instance_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_instance
    ADD CONSTRAINT person_instance_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: person_instance person_instance_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_instance
    ADD CONSTRAINT person_instance_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: person person_person_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_person_type_fkey FOREIGN KEY (person_type) REFERENCES public.person_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: place_instance place_instance_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_instance
    ADD CONSTRAINT place_instance_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: place_instance place_instance_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_instance
    ADD CONSTRAINT place_instance_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: place place_place_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place
    ADD CONSTRAINT place_place_type_id_fkey FOREIGN KEY (place_type_id) REFERENCES public.place_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: place_time_range place_time_range_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_time_range
    ADD CONSTRAINT place_time_range_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: religion_instance religion_instance_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.religion_instance
    ADD CONSTRAINT religion_instance_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: religion_instance religion_instance_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.religion_instance
    ADD CONSTRAINT religion_instance_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religion(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: religion religion_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.religion
    ADD CONSTRAINT religion_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.religion(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: source_instance source_instance_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_instance
    ADD CONSTRAINT source_instance_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: source_instance source_instance_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_instance
    ADD CONSTRAINT source_instance_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.source(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: source source_source_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_source_type_id_fkey FOREIGN KEY (source_type_id) REFERENCES public.source_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tag_evidence tag_evidence_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tag_evidence tag_evidence_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: time_group time_group_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_group
    ADD CONSTRAINT time_group_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: time_instance time_instance_time_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_instance
    ADD CONSTRAINT time_instance_time_group_id_fkey FOREIGN KEY (time_group_id) REFERENCES public.time_group(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uri_namespace uri_namespace_external_database_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uri_namespace
    ADD CONSTRAINT uri_namespace_external_database_id_fkey FOREIGN KEY (external_database_id) REFERENCES public.external_database(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_action user_action_action_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_action_type_id_fkey FOREIGN KEY (action_type_id) REFERENCES public.action_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_action user_action_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_action user_action_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DATABASE ocn; Type: ACL; Schema: -; Owner: postgres
--

GRANT CONNECT ON DATABASE ocn TO ro_dump;
GRANT CONNECT ON DATABASE ocn TO api;
GRANT CONNECT ON DATABASE ocn TO users;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA public TO api;
GRANT USAGE ON SCHEMA public TO users;


--
-- Name: SCHEMA topology; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA topology TO ro_dump;


--
-- Name: TABLE action_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.action_type TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.action_type TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.action_type TO users;


--
-- Name: SEQUENCE action_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.action_type_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.action_type_id_seq TO api;
GRANT ALL ON SEQUENCE public.action_type_id_seq TO users;


--
-- Name: TABLE annotation; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.annotation TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.annotation TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.annotation TO users;


--
-- Name: SEQUENCE annotation_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.annotation_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.annotation_id_seq TO api;
GRANT ALL ON SEQUENCE public.annotation_id_seq TO users;


--
-- Name: TABLE evidence; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.evidence TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.evidence TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.evidence TO users;


--
-- Name: TABLE person_instance; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.person_instance TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.person_instance TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.person_instance TO users;


--
-- Name: TABLE place_instance; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.place_instance TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_instance TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_instance TO users;


--
-- Name: TABLE religion_instance; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.religion_instance TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.religion_instance TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.religion_instance TO users;


--
-- Name: TABLE time_group; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.time_group TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.time_group TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.time_group TO users;


--
-- Name: TABLE annotation_overview; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.annotation_overview TO api;
GRANT SELECT ON TABLE public.annotation_overview TO users;


--
-- Name: TABLE annotation_suggestion; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.annotation_suggestion TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.annotation_suggestion TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.annotation_suggestion TO users;


--
-- Name: TABLE annotation_suggestion_document_state; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.annotation_suggestion_document_state TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.annotation_suggestion_document_state TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.annotation_suggestion_document_state TO users;


--
-- Name: SEQUENCE annotation_suggestion_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.annotation_suggestion_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.annotation_suggestion_id_seq TO api;
GRANT ALL ON SEQUENCE public.annotation_suggestion_id_seq TO users;


--
-- Name: TABLE document; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.document TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document TO users;


--
-- Name: SEQUENCE document_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.document_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.document_id_seq TO api;
GRANT ALL ON SEQUENCE public.document_id_seq TO users;


--
-- Name: SEQUENCE evidence_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.evidence_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.evidence_id_seq TO api;
GRANT ALL ON SEQUENCE public.evidence_id_seq TO users;


--
-- Name: SEQUENCE external_database_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.external_database_id_seq TO ro_dump;
GRANT ALL ON SEQUENCE public.external_database_id_seq TO api;
GRANT ALL ON SEQUENCE public.external_database_id_seq TO users;


--
-- Name: TABLE external_database; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.external_database TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.external_database TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.external_database TO users;


--
-- Name: SEQUENCE external_person_uri_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.external_person_uri_id_seq TO ro_dump;
GRANT ALL ON SEQUENCE public.external_person_uri_id_seq TO api;
GRANT ALL ON SEQUENCE public.external_person_uri_id_seq TO users;


--
-- Name: TABLE external_person_uri; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.external_person_uri TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.external_person_uri TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.external_person_uri TO users;


--
-- Name: SEQUENCE external_place_uri_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.external_place_uri_id_seq TO ro_dump;
GRANT ALL ON SEQUENCE public.external_place_uri_id_seq TO api;
GRANT ALL ON SEQUENCE public.external_place_uri_id_seq TO users;


--
-- Name: TABLE external_place_uri; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.external_place_uri TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.external_place_uri TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.external_place_uri TO users;


--
-- Name: TABLE geography_columns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.geography_columns TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.geography_columns TO users;


--
-- Name: TABLE geometry_columns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.geometry_columns TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.geometry_columns TO users;


--
-- Name: TABLE language; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.language TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.language TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.language TO users;


--
-- Name: SEQUENCE language_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.language_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.language_id_seq TO api;
GRANT ALL ON SEQUENCE public.language_id_seq TO users;


--
-- Name: TABLE name_var; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.name_var TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.name_var TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.name_var TO users;


--
-- Name: SEQUENCE name_var_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.name_var_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.name_var_id_seq TO api;
GRANT ALL ON SEQUENCE public.name_var_id_seq TO users;


--
-- Name: TABLE person; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.person TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.person TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.person TO users;


--
-- Name: SEQUENCE person_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.person_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.person_id_seq TO api;
GRANT ALL ON SEQUENCE public.person_id_seq TO users;


--
-- Name: SEQUENCE person_instance_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.person_instance_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.person_instance_id_seq TO api;
GRANT ALL ON SEQUENCE public.person_instance_id_seq TO users;


--
-- Name: TABLE person_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.person_type TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.person_type TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.person_type TO users;


--
-- Name: SEQUENCE person_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.person_type_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.person_type_id_seq TO api;
GRANT ALL ON SEQUENCE public.person_type_id_seq TO users;


--
-- Name: TABLE place; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.place TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place TO users;


--
-- Name: SEQUENCE place_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.place_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.place_id_seq TO api;
GRANT ALL ON SEQUENCE public.place_id_seq TO users;


--
-- Name: SEQUENCE place_instance_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.place_instance_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.place_instance_id_seq TO api;
GRANT ALL ON SEQUENCE public.place_instance_id_seq TO users;


--
-- Name: TABLE place_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.place_type TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_type TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_type TO users;


--
-- Name: TABLE place_overview; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.place_overview TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_overview TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_overview TO users;


--
-- Name: TABLE source_instance; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.source_instance TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.source_instance TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.source_instance TO users;


--
-- Name: TABLE time_instance; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.time_instance TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.time_instance TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.time_instance TO users;


--
-- Name: TABLE place_religion_overview; Type: ACL; Schema: public; Owner: api
--

GRANT SELECT ON TABLE public.place_religion_overview TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_religion_overview TO users;
GRANT ALL ON TABLE public.place_religion_overview TO postgres;


--
-- Name: TABLE place_set; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.place_set TO ro_dump;


--
-- Name: TABLE place_time_range; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.place_time_range TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_time_range TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.place_time_range TO users;


--
-- Name: SEQUENCE place_time_range_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.place_time_range_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.place_time_range_id_seq TO api;
GRANT ALL ON SEQUENCE public.place_time_range_id_seq TO users;


--
-- Name: SEQUENCE place_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.place_type_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.place_type_id_seq TO api;
GRANT ALL ON SEQUENCE public.place_type_id_seq TO users;


--
-- Name: TABLE religion; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.religion TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.religion TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.religion TO users;


--
-- Name: SEQUENCE religion_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.religion_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.religion_id_seq TO api;
GRANT ALL ON SEQUENCE public.religion_id_seq TO users;


--
-- Name: SEQUENCE religion_instance_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.religion_instance_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.religion_instance_id_seq TO api;
GRANT ALL ON SEQUENCE public.religion_instance_id_seq TO users;


--
-- Name: TABLE religions_per_place; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.religions_per_place TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.religions_per_place TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.religions_per_place TO users;


--
-- Name: TABLE source; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.source TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.source TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.source TO users;


--
-- Name: SEQUENCE source_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.source_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.source_id_seq TO api;
GRANT ALL ON SEQUENCE public.source_id_seq TO users;


--
-- Name: SEQUENCE source_instance_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.source_instance_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.source_instance_id_seq TO api;
GRANT ALL ON SEQUENCE public.source_instance_id_seq TO users;


--
-- Name: TABLE source_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.source_type TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.source_type TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.source_type TO users;


--
-- Name: SEQUENCE source_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.source_type_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.source_type_id_seq TO api;
GRANT ALL ON SEQUENCE public.source_type_id_seq TO users;


--
-- Name: TABLE spatial_ref_sys; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.spatial_ref_sys TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.spatial_ref_sys TO users;


--
-- Name: TABLE tag; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tag TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tag TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tag TO users;


--
-- Name: TABLE tag_evidence; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tag_evidence TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tag_evidence TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tag_evidence TO users;


--
-- Name: SEQUENCE tag_evidence_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.tag_evidence_id_seq TO ro_dump;
GRANT ALL ON SEQUENCE public.tag_evidence_id_seq TO api;
GRANT ALL ON SEQUENCE public.tag_evidence_id_seq TO users;


--
-- Name: SEQUENCE tag_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.tag_id_seq TO ro_dump;
GRANT ALL ON SEQUENCE public.tag_id_seq TO api;
GRANT ALL ON SEQUENCE public.tag_id_seq TO users;


--
-- Name: SEQUENCE time_group_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.time_group_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.time_group_id_seq TO api;
GRANT ALL ON SEQUENCE public.time_group_id_seq TO users;


--
-- Name: SEQUENCE time_instance_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.time_instance_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.time_instance_id_seq TO api;
GRANT ALL ON SEQUENCE public.time_instance_id_seq TO users;


--
-- Name: SEQUENCE uri_namespace_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.uri_namespace_id_seq TO ro_dump;
GRANT ALL ON SEQUENCE public.uri_namespace_id_seq TO api;
GRANT ALL ON SEQUENCE public.uri_namespace_id_seq TO users;


--
-- Name: TABLE uri_namespace; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.uri_namespace TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.uri_namespace TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.uri_namespace TO users;


--
-- Name: TABLE user_action; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.user_action TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_action TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_action TO users;


--
-- Name: SEQUENCE user_action_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.user_action_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.user_action_id_seq TO api;
GRANT ALL ON SEQUENCE public.user_action_id_seq TO users;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.users TO ro_dump;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO api;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO users;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.users_id_seq TO ro_dump;
GRANT SELECT,UPDATE ON SEQUENCE public.users_id_seq TO api;
GRANT ALL ON SEQUENCE public.users_id_seq TO users;


--
-- Name: TABLE layer; Type: ACL; Schema: topology; Owner: postgres
--

GRANT SELECT ON TABLE topology.layer TO ro_dump;


--
-- Name: TABLE topology; Type: ACL; Schema: topology; Owner: postgres
--

GRANT SELECT ON TABLE topology.topology TO ro_dump;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES  FROM postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,UPDATE ON SEQUENCES  TO users;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,UPDATE ON SEQUENCES  TO api;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON SEQUENCES  TO ro_dump;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: api
--

ALTER DEFAULT PRIVILEGES FOR ROLE api IN SCHEMA public REVOKE ALL ON SEQUENCES  FROM api;
ALTER DEFAULT PRIVILEGES FOR ROLE api IN SCHEMA public GRANT SELECT,UPDATE ON SEQUENCES  TO api;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: users
--

ALTER DEFAULT PRIVILEGES FOR ROLE users IN SCHEMA public REVOKE ALL ON SEQUENCES  FROM users;
ALTER DEFAULT PRIVILEGES FOR ROLE users IN SCHEMA public GRANT SELECT,UPDATE ON SEQUENCES  TO users;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES  FROM postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO api;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES  TO ro_dump;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: api
--

ALTER DEFAULT PRIVILEGES FOR ROLE api IN SCHEMA public REVOKE ALL ON TABLES  FROM api;
ALTER DEFAULT PRIVILEGES FOR ROLE api IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO api;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: users
--

ALTER DEFAULT PRIVILEGES FOR ROLE users IN SCHEMA public REVOKE ALL ON TABLES  FROM users;
ALTER DEFAULT PRIVILEGES FOR ROLE users IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO users;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: topology; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA topology REVOKE ALL ON TABLES  FROM postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA topology GRANT SELECT ON TABLES  TO ro_dump;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES  TO users;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO users;


--
-- PostgreSQL database dump complete
--

