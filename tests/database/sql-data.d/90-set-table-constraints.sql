\connect ocn

--
-- Name: action_type action_type_name_key; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.action_type
    ADD CONSTRAINT action_type_name_key UNIQUE (name);


--
-- Name: action_type action_type_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.action_type
    ADD CONSTRAINT action_type_pkey PRIMARY KEY (id);


--
-- Name: advanced_religion_filter advanced_religion_filter_description_key; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.advanced_religion_filter
    ADD CONSTRAINT advanced_religion_filter_description_key UNIQUE (description);


--
-- Name: advanced_religion_filter advanced_religion_filter_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.advanced_religion_filter
    ADD CONSTRAINT advanced_religion_filter_pkey PRIMARY KEY (id);


--
-- Name: annotation annotation_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.annotation
    ADD CONSTRAINT annotation_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.annotation_suggestion
    ADD CONSTRAINT annotation_suggestion_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.annotation_suggestion_document_state
  ADD CONSTRAINT annotation_suggestion_document_state_document_id_key UNIQUE (document_id);


--
-- Name: bishopric bishopric_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric
    ADD CONSTRAINT bishopric_pkey PRIMARY KEY (id);


--
-- Name: bishopric_place bishopric_place_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_place
    ADD CONSTRAINT bishopric_place_pkey PRIMARY KEY (id);


--
-- Name: bishopric_residence bishopric_residence_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_residence
    ADD CONSTRAINT bishopric_residence_pkey PRIMARY KEY (id);


--
-- Name: bishopric_type bishopric_type_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_type
    ADD CONSTRAINT bishopric_type_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_pkey PRIMARY KEY (id);


--
-- Name: external_database external_database__short_name_unique; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_database
    ADD CONSTRAINT external_database__short_name_unique UNIQUE (short_name);


--
-- Name: external_database external_database_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_database
    ADD CONSTRAINT external_database_pkey PRIMARY KEY (id);


--
-- Name: external_person_uri external_person_uri_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_person_uri
    ADD CONSTRAINT external_person_uri_pkey PRIMARY KEY (id);


--
-- Name: external_place_uri external_place_uri_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_place_uri
    ADD CONSTRAINT external_place_uri_pkey PRIMARY KEY (id);


--
-- Name: language language_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.language
    ADD CONSTRAINT language_pkey PRIMARY KEY (id);


--
-- Name: name_var name_var_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.name_var
    ADD CONSTRAINT name_var_pkey PRIMARY KEY (id);


--
-- Name: person_bishopric person_bishopric_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_bishopric
    ADD CONSTRAINT person_bishopric_pkey PRIMARY KEY (id);


--
-- Name: person_instance person_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_instance
    ADD CONSTRAINT person_instance_pkey PRIMARY KEY (id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);

--
-- Name: person person__name__time_range__unique; Type: UNIQUE CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person__name__time_range__unique UNIQUE (name, time_range);

--
-- Name: person_type person_type_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_type
    ADD CONSTRAINT person_type_pkey PRIMARY KEY (id);


--
-- Name: place_instance place_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_instance
    ADD CONSTRAINT place_instance_pkey PRIMARY KEY (id);


--
-- Name: place place_name_key; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place
    ADD CONSTRAINT place_name_key UNIQUE (name);


--
-- Name: place place_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place
    ADD CONSTRAINT place_pkey PRIMARY KEY (id);


--
-- Name: place_time_range place_time_range_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_time_range
    ADD CONSTRAINT place_time_range_pkey PRIMARY KEY (id);


--
-- Name: place_type place_type_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_type
    ADD CONSTRAINT place_type_pkey PRIMARY KEY (id);


--
-- Name: religion_filter_group religion_filter_group_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_filter_group
    ADD CONSTRAINT religion_filter_group_pkey PRIMARY KEY (id);


--
-- Name: religion_filter_group_set religion_filter_group_set_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_filter_group_set
    ADD CONSTRAINT religion_filter_group_set_pkey PRIMARY KEY (id);


--
-- Name: religion_instance religion_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_instance
    ADD CONSTRAINT religion_instance_pkey PRIMARY KEY (id);


--
-- Name: religion religion_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion
    ADD CONSTRAINT religion_pkey PRIMARY KEY (id);


--
-- Name: source_bishopric source_bishopric_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_bishopric
    ADD CONSTRAINT source_bishopric_pkey PRIMARY KEY (id);


--
-- Name: source_instance source_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_instance
    ADD CONSTRAINT source_instance_pkey PRIMARY KEY (id);


--
-- Name: source source_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_pkey PRIMARY KEY (id);


--
-- Name: source source_short_key; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_short_key UNIQUE (short);


--
-- Name: source_type source_type_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_type
    ADD CONSTRAINT source_type_pkey PRIMARY KEY (id);


--
-- Name: tag_evidence tag_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_pkey PRIMARY KEY (id);


--
-- Name: tag_evidence tag_evidence_tag_id_evidence_id_unique; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_tag_id_evidence_id_unique UNIQUE (tag_id, evidence_id);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: tag tag_tagname_key; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_tagname_key UNIQUE (tagname);


--
-- Name: time_group time_group_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.time_group
    ADD CONSTRAINT time_group_pkey PRIMARY KEY (id);


--
-- Name: time_instance time_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.time_instance
    ADD CONSTRAINT time_instance_pkey PRIMARY KEY (id);


--
-- Name: uri_namespace uri_namespace_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.uri_namespace
    ADD CONSTRAINT uri_namespace_pkey PRIMARY KEY (id);


--
-- Name: user_action user_action_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_pkey PRIMARY KEY (id);


--
-- Name: users users_name_key; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_name_key UNIQUE (name);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: annotation annotation_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.annotation
    ADD CONSTRAINT annotation_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.annotation_suggestion
    ADD CONSTRAINT annotation_suggestion_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.annotation_suggestion_document_state
    ADD CONSTRAINT annotation_suggestion_document_state_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: bishopric bishopric_bishopric_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric
    ADD CONSTRAINT bishopric_bishopric_type_id_fkey FOREIGN KEY (bishopric_type_id) REFERENCES public.bishopric_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bishopric_place bishopric_place_bishopric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_place
    ADD CONSTRAINT bishopric_place_bishopric_id_fkey FOREIGN KEY (bishopric_id) REFERENCES public.bishopric(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bishopric_place bishopric_place_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_place
    ADD CONSTRAINT bishopric_place_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bishopric bishopric_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric
    ADD CONSTRAINT bishopric_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religion(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bishopric_residence bishopric_residence_bishopric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_residence
    ADD CONSTRAINT bishopric_residence_bishopric_id_fkey FOREIGN KEY (bishopric_id) REFERENCES public.bishopric(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bishopric_residence bishopric_residence_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.bishopric_residence
    ADD CONSTRAINT bishopric_residence_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: document document_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.source(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: evidence evidence_person_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_person_instance_id_fkey FOREIGN KEY (person_instance_id) REFERENCES public.person_instance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evidence evidence_place_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_place_instance_id_fkey FOREIGN KEY (place_instance_id) REFERENCES public.place_instance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evidence evidence_religion_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_religion_instance_id_fkey FOREIGN KEY (religion_instance_id) REFERENCES public.religion_instance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evidence evidence_time_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_time_group_id_fkey FOREIGN KEY (time_group_id) REFERENCES public.time_group(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: external_person_uri external_person_uri_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_person_uri
    ADD CONSTRAINT external_person_uri_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_person_uri external_person_uri_uri_namespace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_person_uri
    ADD CONSTRAINT external_person_uri_uri_namespace_id_fkey FOREIGN KEY (uri_namespace_id) REFERENCES public.uri_namespace(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_place_uri external_place_uri_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_place_uri
    ADD CONSTRAINT external_place_uri_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_place_uri external_place_uri_uri_namespace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.external_place_uri
    ADD CONSTRAINT external_place_uri_uri_namespace_id_fkey FOREIGN KEY (uri_namespace_id) REFERENCES public.uri_namespace(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: name_var name_var_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.name_var
    ADD CONSTRAINT name_var_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.language(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: name_var name_var_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.name_var
    ADD CONSTRAINT name_var_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: person_bishopric person_bishopric_bishopric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_bishopric
    ADD CONSTRAINT person_bishopric_bishopric_id_fkey FOREIGN KEY (bishopric_id) REFERENCES public.bishopric(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: person_bishopric person_bishopric_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_bishopric
    ADD CONSTRAINT person_bishopric_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: person_bishopric person_bishopric_predecessor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_bishopric
    ADD CONSTRAINT person_bishopric_predecessor_id_fkey FOREIGN KEY (predecessor_id) REFERENCES public.person_bishopric(id);


--
-- Name: person_instance person_instance_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_instance
    ADD CONSTRAINT person_instance_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: person_instance person_instance_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person_instance
    ADD CONSTRAINT person_instance_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: person person_person_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_person_type_fkey FOREIGN KEY (person_type) REFERENCES public.person_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: place_instance place_instance_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_instance
    ADD CONSTRAINT place_instance_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: place_instance place_instance_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_instance
    ADD CONSTRAINT place_instance_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: place place_place_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place
    ADD CONSTRAINT place_place_type_id_fkey FOREIGN KEY (place_type_id) REFERENCES public.place_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: place_time_range place_time_range_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.place_time_range
    ADD CONSTRAINT place_time_range_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.place(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: religion_filter_group religion_filter_group_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_filter_group
    ADD CONSTRAINT religion_filter_group_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religion(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: religion_filter_group_set religion_filter_group_set_filter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_filter_group_set
    ADD CONSTRAINT religion_filter_group_set_filter_id_fkey FOREIGN KEY (filter_id) REFERENCES public.advanced_religion_filter(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: religion_filter_group religion_filter_group_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_filter_group
    ADD CONSTRAINT religion_filter_group_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.religion_filter_group_set(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: religion_instance religion_instance_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_instance
    ADD CONSTRAINT religion_instance_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: religion_instance religion_instance_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion_instance
    ADD CONSTRAINT religion_instance_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religion(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: religion religion_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.religion
    ADD CONSTRAINT religion_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.religion(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: source_bishopric source_bishopric_bishopric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_bishopric
    ADD CONSTRAINT source_bishopric_bishopric_id_fkey FOREIGN KEY (bishopric_id) REFERENCES public.bishopric(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: source_bishopric source_bishopric_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_bishopric
    ADD CONSTRAINT source_bishopric_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.source(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: source_instance source_instance_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_instance
    ADD CONSTRAINT source_instance_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: source_instance source_instance_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source_instance
    ADD CONSTRAINT source_instance_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.source(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: source source_source_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_source_type_id_fkey FOREIGN KEY (source_type_id) REFERENCES public.source_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tag_evidence tag_evidence_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tag_evidence tag_evidence_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.tag_evidence
    ADD CONSTRAINT tag_evidence_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: time_group time_group_annotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.time_group
    ADD CONSTRAINT time_group_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotation(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: time_instance time_instance_time_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.time_instance
    ADD CONSTRAINT time_instance_time_group_id_fkey FOREIGN KEY (time_group_id) REFERENCES public.time_group(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uri_namespace uri_namespace_external_database_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.uri_namespace
    ADD CONSTRAINT uri_namespace_external_database_id_fkey FOREIGN KEY (external_database_id) REFERENCES public.external_database(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_action user_action_action_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_action_type_id_fkey FOREIGN KEY (action_type_id) REFERENCES public.action_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_action user_action_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_action user_action_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: docker
--

ALTER TABLE ONLY public.user_action
    ADD CONSTRAINT user_action_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
