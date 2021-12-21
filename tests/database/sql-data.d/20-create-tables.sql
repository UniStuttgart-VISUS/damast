\connect ocn

--
-- Name: action_type; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.action_type (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.action_type OWNER TO docker;

--
-- Name: action_type_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.action_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.action_type_id_seq OWNER TO docker;

--
-- Name: action_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.action_type_id_seq OWNED BY public.action_type.id;


--
-- Name: advanced_religion_filter; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.advanced_religion_filter (
    id integer NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.advanced_religion_filter OWNER TO docker;

--
-- Name: advanced_religion_filter_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.advanced_religion_filter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.advanced_religion_filter_id_seq OWNER TO docker;

--
-- Name: advanced_religion_filter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.advanced_religion_filter_id_seq OWNED BY public.advanced_religion_filter.id;


--
-- Name: annotation; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.annotation (
    id integer NOT NULL,
    document_id integer NOT NULL,
    span int4range NOT NULL,
    comment text
);


ALTER TABLE public.annotation OWNER TO docker;

--
-- Name: annotation_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.annotation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.annotation_id_seq OWNER TO docker;

--
-- Name: annotation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.annotation_id_seq OWNED BY public.annotation.id;


CREATE TABLE public.annotation_suggestion (
  id          INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  span        int4range NOT NULL,
  source      TEXT[] NOT NULL,
  type        TEXT NOT NULL,
  entity_id   INTEGER NOT NULL
);

ALTER TABLE public.annotation_suggestion OWNER TO docker;

CREATE SEQUENCE public.annotation_suggestion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.annotation_suggestion_id_seq OWNER TO docker;
ALTER SEQUENCE public.annotation_suggestion_id_seq OWNED BY public.annotation_suggestion.id;


--
-- Name: annotation_suggestion_document_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.annotation_suggestion_document_state (
    document_id integer NOT NULL,
    suggestion_hash text NOT NULL
);


ALTER TABLE public.annotation_suggestion_document_state OWNER TO postgres;


--
-- Name: evidence; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.evidence (
    id integer NOT NULL,
    time_group_id integer,
    place_instance_id integer NOT NULL,
    religion_instance_id integer NOT NULL,
    person_instance_id integer,
    interpretation_confidence public.confidence_value,
    visible boolean NOT NULL,
    comment text
);


ALTER TABLE public.evidence OWNER TO docker;

--
-- Name: person_instance; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.person_instance (
    id integer NOT NULL,
    person_id integer NOT NULL,
    annotation_id integer,
    confidence public.confidence_value,
    comment text
);


ALTER TABLE public.person_instance OWNER TO docker;

--
-- Name: place_instance; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.place_instance (
    id integer NOT NULL,
    place_id integer NOT NULL,
    annotation_id integer,
    confidence public.confidence_value,
    comment text
);


ALTER TABLE public.place_instance OWNER TO docker;

--
-- Name: religion_instance; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.religion_instance (
    id integer NOT NULL,
    religion_id integer NOT NULL,
    annotation_id integer,
    confidence public.confidence_value,
    comment text
);


ALTER TABLE public.religion_instance OWNER TO docker;

--
-- Name: time_group; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.time_group (
    id integer NOT NULL,
    annotation_id integer
);


ALTER TABLE public.time_group OWNER TO docker;

--
-- Name: annotation_overview; Type: VIEW; Schema: public; Owner: docker
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


ALTER TABLE public.annotation_overview OWNER TO docker;

--
-- Name: bishopric; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.bishopric (
    id integer NOT NULL,
    name text NOT NULL,
    bishopric_type_id integer NOT NULL,
    religion_id integer NOT NULL,
    comment text,
    time_span int4range
);


ALTER TABLE public.bishopric OWNER TO docker;

--
-- Name: bishopric_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.bishopric_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bishopric_id_seq OWNER TO docker;

--
-- Name: bishopric_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.bishopric_id_seq OWNED BY public.bishopric.id;


--
-- Name: bishopric_place; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.bishopric_place (
    id integer NOT NULL,
    place_id integer NOT NULL,
    bishopric_id integer NOT NULL,
    time_start integer,
    time_end integer
);


ALTER TABLE public.bishopric_place OWNER TO docker;

--
-- Name: bishopric_place_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.bishopric_place_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bishopric_place_id_seq OWNER TO docker;

--
-- Name: bishopric_place_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.bishopric_place_id_seq OWNED BY public.bishopric_place.id;


--
-- Name: bishopric_residence; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.bishopric_residence (
    id integer NOT NULL,
    place_id integer NOT NULL,
    bishopric_id integer NOT NULL,
    timespan int4range
);


ALTER TABLE public.bishopric_residence OWNER TO docker;

--
-- Name: bishopric_residence_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.bishopric_residence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bishopric_residence_id_seq OWNER TO docker;

--
-- Name: bishopric_residence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.bishopric_residence_id_seq OWNED BY public.bishopric_residence.id;


--
-- Name: bishopric_type; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.bishopric_type (
    id integer NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.bishopric_type OWNER TO docker;

--
-- Name: bishopric_type_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.bishopric_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bishopric_type_id_seq OWNER TO docker;

--
-- Name: bishopric_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.bishopric_type_id_seq OWNED BY public.bishopric_type.id;


--
-- Name: document; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.document (
    id integer NOT NULL,
    source_id integer NOT NULL,
    version integer NOT NULL,
    comment text,
    content_type text NOT NULL,
    content_length integer NOT NULL,
    content bytea NOT NULL
);


ALTER TABLE public.document OWNER TO docker;

--
-- Name: document_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.document_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.document_id_seq OWNER TO docker;

--
-- Name: document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.document_id_seq OWNED BY public.document.id;


--
-- Name: evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.evidence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.evidence_id_seq OWNER TO docker;

--
-- Name: evidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.evidence_id_seq OWNED BY public.evidence.id;


--
-- Name: external_database; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.external_database (
    id integer NOT NULL,
    name text NOT NULL,
    short_name text NOT NULL,
    url text,
    comment text
);


ALTER TABLE public.external_database OWNER TO docker;

--
-- Name: external_database_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.external_database_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.external_database_id_seq OWNER TO docker;


--
-- Name: external_person_uri; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.external_person_uri (
    id integer NOT NULL,
    person_id integer NOT NULL,
    uri_namespace_id integer NOT NULL,
    uri_fragment text NOT NULL,
    comment text
);


ALTER TABLE public.external_person_uri OWNER TO docker;

--
-- name: external_person_uri_id_seq; type: sequence; schema: public; owner: docker
--

create sequence public.external_person_uri_id_seq
    as integer
    start with 1
    increment by 1
    no minvalue
    no maxvalue
    cache 1;


alter table public.external_person_uri_id_seq owner to docker;


--
-- Name: external_place_uri; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.external_place_uri (
    id integer NOT NULL,
    place_id integer NOT NULL,
    uri_namespace_id integer NOT NULL,
    uri_fragment text NOT NULL,
    comment text
);


ALTER TABLE public.external_place_uri OWNER TO docker;

--
-- name: external_place_uri_id_seq; type: sequence; schema: public; owner: docker
--

create sequence public.external_place_uri_id_seq
    as integer
    start with 1
    increment by 1
    no minvalue
    no maxvalue
    cache 1;


alter table public.external_place_uri_id_seq owner to docker;


--
-- Name: language; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.language (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.language OWNER TO docker;

--
-- Name: language_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.language_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.language_id_seq OWNER TO docker;

--
-- Name: language_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.language_id_seq OWNED BY public.language.id;


--
-- Name: name_var; Type: TABLE; Schema: public; Owner: docker
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


ALTER TABLE public.name_var OWNER TO docker;

--
-- Name: name_var_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.name_var_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.name_var_id_seq OWNER TO docker;

--
-- Name: name_var_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.name_var_id_seq OWNED BY public.name_var.id;


--
-- Name: person; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.person (
    id integer NOT NULL,
    name text NOT NULL,
    time_range text NOT NULL DEFAULT '',
    comment text,
    person_type integer NOT NULL
);


ALTER TABLE public.person OWNER TO docker;

--
-- Name: person_bishopric; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.person_bishopric (
    id integer NOT NULL,
    bishopric_id integer NOT NULL,
    person_id integer NOT NULL,
    predecessor_id integer,
    timespan int4range
);


ALTER TABLE public.person_bishopric OWNER TO docker;

--
-- Name: person_bishopric_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.person_bishopric_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.person_bishopric_id_seq OWNER TO docker;

--
-- Name: person_bishopric_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.person_bishopric_id_seq OWNED BY public.person_bishopric.id;


--
-- Name: person_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.person_id_seq OWNER TO docker;

--
-- Name: person_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.person_id_seq OWNED BY public.person.id;


--
-- Name: person_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.person_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.person_instance_id_seq OWNER TO docker;

--
-- Name: person_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.person_instance_id_seq OWNED BY public.person_instance.id;


--
-- Name: person_type; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.person_type (
    id integer NOT NULL,
    type text NOT NULL
);


ALTER TABLE public.person_type OWNER TO docker;

--
-- Name: person_type_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.person_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.person_type_id_seq OWNER TO docker;

--
-- Name: person_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.person_type_id_seq OWNED BY public.person_type.id;


--
-- Name: place; Type: TABLE; Schema: public; Owner: docker
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


ALTER TABLE public.place OWNER TO docker;

--
-- Name: place_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.place_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_id_seq OWNER TO docker;

--
-- Name: place_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.place_id_seq OWNED BY public.place.id;


--
-- Name: place_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.place_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_instance_id_seq OWNER TO docker;

--
-- Name: place_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.place_instance_id_seq OWNED BY public.place_instance.id;


--
-- Name: place_type; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.place_type (
    id integer NOT NULL,
    type text NOT NULL,
    visible boolean DEFAULT true NOT NULL
);


ALTER TABLE public.place_type OWNER TO docker;

--
-- Name: place_overview; Type: VIEW; Schema: public; Owner: docker
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


ALTER TABLE public.place_overview OWNER TO docker;

--
-- Name: source_instance; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.source_instance (
    id integer NOT NULL,
    source_id integer NOT NULL,
    evidence_id integer NOT NULL,
    source_page text,
    source_confidence public.confidence_value,
    comment text
);


ALTER TABLE public.source_instance OWNER TO docker;

--
-- Name: time_instance; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.time_instance (
    id integer NOT NULL,
    time_group_id integer NOT NULL,
    span int4range,
    confidence public.confidence_value,
    comment text
);


ALTER TABLE public.time_instance OWNER TO docker;


-- place sets
CREATE TABLE public.place_set (
  uuid          UUID UNIQUE NOT NULL,
  description   TEXT NOT NULL,
  filter        INTEGER[] NOT NULL,
  date          TEXT NOT NULL,
  username      TEXT NOT NULL
);

ALTER TABLE public.place_set OWNER TO docker;

--
-- Name: place_religion_overview; Type: VIEW; Schema: public; Owner: docker
--

CREATE VIEW public.place_religion_overview AS
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
  ORDER BY evidence.id;


ALTER TABLE public.place_religion_overview OWNER TO docker;

--
-- Name: place_time_range; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.place_time_range (
    id integer NOT NULL,
    place_id integer NOT NULL,
    time_start integer NOT NULL,
    time_end integer NOT NULL
);


ALTER TABLE public.place_time_range OWNER TO docker;

--
-- Name: place_time_range_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.place_time_range_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_time_range_id_seq OWNER TO docker;

--
-- Name: place_time_range_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.place_time_range_id_seq OWNED BY public.place_time_range.id;


--
-- Name: place_type_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.place_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.place_type_id_seq OWNER TO docker;

--
-- Name: place_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.place_type_id_seq OWNED BY public.place_type.id;


--
-- Name: religion; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.religion (
    id integer NOT NULL,
    name text NOT NULL,
    abbreviation text NOT NULL,
    color text NOT NULL,
    parent_id integer
);


ALTER TABLE public.religion OWNER TO docker;

--
-- Name: religion_filter_group; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.religion_filter_group (
    id integer NOT NULL,
    religion_id integer NOT NULL,
    set_id integer NOT NULL
);


ALTER TABLE public.religion_filter_group OWNER TO docker;

--
-- Name: religion_filter_group_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.religion_filter_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.religion_filter_group_id_seq OWNER TO docker;

--
-- Name: religion_filter_group_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.religion_filter_group_id_seq OWNED BY public.religion_filter_group.id;


--
-- Name: religion_filter_group_set; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.religion_filter_group_set (
    id integer NOT NULL,
    filter_id integer NOT NULL
);


ALTER TABLE public.religion_filter_group_set OWNER TO docker;

--
-- Name: religion_filter_group_set_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.religion_filter_group_set_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.religion_filter_group_set_id_seq OWNER TO docker;

--
-- Name: religion_filter_group_set_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.religion_filter_group_set_id_seq OWNED BY public.religion_filter_group_set.id;


--
-- Name: religion_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.religion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.religion_id_seq OWNER TO docker;

--
-- Name: religion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.religion_id_seq OWNED BY public.religion.id;


--
-- Name: religion_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.religion_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.religion_instance_id_seq OWNER TO docker;

--
-- Name: religion_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.religion_instance_id_seq OWNED BY public.religion_instance.id;


--
-- Name: source; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.source (
    id integer NOT NULL,
    name text NOT NULL,
    source_type_id integer NOT NULL,
    default_confidence public.confidence_value,
    short text NOT NULL
);


ALTER TABLE public.source OWNER TO docker;

--
-- Name: source_bishopric; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.source_bishopric (
    id integer NOT NULL,
    bishopric_id integer NOT NULL,
    source_id integer NOT NULL,
    citation text
);


ALTER TABLE public.source_bishopric OWNER TO docker;

--
-- Name: source_bishopric_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.source_bishopric_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.source_bishopric_id_seq OWNER TO docker;

--
-- Name: source_bishopric_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.source_bishopric_id_seq OWNED BY public.source_bishopric.id;


--
-- Name: source_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.source_id_seq OWNER TO docker;

--
-- Name: source_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.source_id_seq OWNED BY public.source.id;


--
-- Name: source_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.source_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.source_instance_id_seq OWNER TO docker;

--
-- Name: source_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.source_instance_id_seq OWNED BY public.source_instance.id;


--
-- Name: source_type; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.source_type (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.source_type OWNER TO docker;

--
-- Name: source_type_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.source_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.source_type_id_seq OWNER TO docker;

--
-- Name: source_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.source_type_id_seq OWNED BY public.source_type.id;


--
-- Name: tag_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.tag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tag_id_seq OWNER TO docker;

--
-- Name: tag; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.tag (
    id integer DEFAULT nextval('public.tag_id_seq'::regclass) NOT NULL,
    tagname text NOT NULL,
    comment text
);


ALTER TABLE public.tag OWNER TO docker;

--
-- Name: tag_evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.tag_evidence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tag_evidence_id_seq OWNER TO docker;

--
-- Name: tag_evidence; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.tag_evidence (
    id integer DEFAULT nextval('public.tag_evidence_id_seq'::regclass) NOT NULL,
    tag_id integer NOT NULL,
    evidence_id integer NOT NULL
);


ALTER TABLE public.tag_evidence OWNER TO docker;

--
-- Name: time_group_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.time_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.time_group_id_seq OWNER TO docker;

--
-- Name: time_group_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.time_group_id_seq OWNED BY public.time_group.id;


--
-- Name: time_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.time_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.time_instance_id_seq OWNER TO docker;

--
-- Name: time_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.time_instance_id_seq OWNED BY public.time_instance.id;


--
-- Name: uri_namespace; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.uri_namespace (
    id integer NOT NULL,
    external_database_id integer NOT NULL,
    uri_pattern text NOT NULL,
    short_name text NOT NULL,
    comment text,
    CONSTRAINT uri_namespace__short_name_is_template CHECK ((short_name ~~ '%\%s%'::text)),
    CONSTRAINT uri_namespace__uri_pattern_is_template CHECK ((uri_pattern ~~ '%\%s%'::text))
);


ALTER TABLE public.uri_namespace OWNER TO docker;

--
-- Name: uri_namespace_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.uri_namespace_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.uri_namespace_id_seq OWNER TO docker;

--
-- Name: user_action; Type: TABLE; Schema: public; Owner: docker
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


ALTER TABLE public.user_action OWNER TO docker;

--
-- Name: user_action_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.user_action_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_action_id_seq OWNER TO docker;

--
-- Name: user_action_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.user_action_id_seq OWNED BY public.user_action.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: docker
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    comment text
);


ALTER TABLE public.users OWNER TO docker;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: docker
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO docker;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: docker
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: action_type id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.action_type ALTER COLUMN id SET DEFAULT nextval('public.action_type_id_seq'::regclass);


--
-- Name: advanced_religion_filter id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.advanced_religion_filter ALTER COLUMN id SET DEFAULT nextval('public.advanced_religion_filter_id_seq'::regclass);


--
-- Name: annotation id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.annotation ALTER COLUMN id SET DEFAULT nextval('public.annotation_id_seq'::regclass);

ALTER TABLE ONLY public.annotation_suggestion ALTER COLUMN id SET DEFAULT nextval('public.annotation_suggestion_id_seq'::regclass);

--
-- Name: bishopric id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric ALTER COLUMN id SET DEFAULT nextval('public.bishopric_id_seq'::regclass);

--
-- Name: bishopric_place id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_place ALTER COLUMN id SET DEFAULT nextval('public.bishopric_place_id_seq'::regclass);


--
-- Name: bishopric_residence id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_residence ALTER COLUMN id SET DEFAULT nextval('public.bishopric_residence_id_seq'::regclass);


--
-- Name: bishopric_type id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_type ALTER COLUMN id SET DEFAULT nextval('public.bishopric_type_id_seq'::regclass);


--
-- Name: document id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.document ALTER COLUMN id SET DEFAULT nextval('public.document_id_seq'::regclass);


--
-- Name: evidence id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.evidence ALTER COLUMN id SET DEFAULT nextval('public.evidence_id_seq'::regclass);


--
-- Name: language id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.language ALTER COLUMN id SET DEFAULT nextval('public.language_id_seq'::regclass);


--
-- Name: name_var id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.name_var ALTER COLUMN id SET DEFAULT nextval('public.name_var_id_seq'::regclass);


--
-- Name: person id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person ALTER COLUMN id SET DEFAULT nextval('public.person_id_seq'::regclass);


--
-- Name: person_bishopric id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_bishopric ALTER COLUMN id SET DEFAULT nextval('public.person_bishopric_id_seq'::regclass);


--
-- Name: person_instance id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_instance ALTER COLUMN id SET DEFAULT nextval('public.person_instance_id_seq'::regclass);


--
-- Name: person_type id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_type ALTER COLUMN id SET DEFAULT nextval('public.person_type_id_seq'::regclass);


--
-- Name: place id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place ALTER COLUMN id SET DEFAULT nextval('public.place_id_seq'::regclass);


--
-- Name: place_instance id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_instance ALTER COLUMN id SET DEFAULT nextval('public.place_instance_id_seq'::regclass);


--
-- Name: place_time_range id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_time_range ALTER COLUMN id SET DEFAULT nextval('public.place_time_range_id_seq'::regclass);


--
-- Name: place_type id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_type ALTER COLUMN id SET DEFAULT nextval('public.place_type_id_seq'::regclass);


--
-- Name: religion id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion ALTER COLUMN id SET DEFAULT nextval('public.religion_id_seq'::regclass);


--
-- Name: religion_filter_group id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_filter_group ALTER COLUMN id SET DEFAULT nextval('public.religion_filter_group_id_seq'::regclass);


--
-- Name: religion_filter_group_set id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_filter_group_set ALTER COLUMN id SET DEFAULT nextval('public.religion_filter_group_set_id_seq'::regclass);


--
-- Name: religion_instance id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_instance ALTER COLUMN id SET DEFAULT nextval('public.religion_instance_id_seq'::regclass);


--
-- Name: source id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source ALTER COLUMN id SET DEFAULT nextval('public.source_id_seq'::regclass);


--
-- Name: source_bishopric id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_bishopric ALTER COLUMN id SET DEFAULT nextval('public.source_bishopric_id_seq'::regclass);


--
-- Name: source_instance id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_instance ALTER COLUMN id SET DEFAULT nextval('public.source_instance_id_seq'::regclass);


--
-- Name: source_type id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_type ALTER COLUMN id SET DEFAULT nextval('public.source_type_id_seq'::regclass);


--
-- Name: time_group id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.time_group ALTER COLUMN id SET DEFAULT nextval('public.time_group_id_seq'::regclass);


--
-- Name: time_instance id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.time_instance ALTER COLUMN id SET DEFAULT nextval('public.time_instance_id_seq'::regclass);


--
-- Name: user_action id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.user_action ALTER COLUMN id SET DEFAULT nextval('public.user_action_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: external_database id; Type: DEFAULT; Schema: public; Owner: docker
--
ALTER TABLE ONLY public.external_database ALTER COLUMN id SET DEFAULT nextval('public.external_database_id_seq'::regclass);


--
-- Name: uri_namespace id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.uri_namespace ALTER COLUMN id SET DEFAULT nextval('public.uri_namespace_id_seq'::regclass);

--
-- Name: external_place_uri id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_place_uri ALTER COLUMN id SET DEFAULT nextval('public.external_place_uri_id_seq'::regclass);

--
-- Name: external_person_uri id; Type: DEFAULT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_person_uri ALTER COLUMN id SET DEFAULT nextval('public.external_person_uri_id_seq'::regclass);
