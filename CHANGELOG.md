# CHANGELOG

## v1.3.0

Release date: *2024-xx-xx*

Change the tags view header and filter behavior to match that of the sources view (select all, none, invert; sort by name or evidence count; no selection means no match) ([220](https://github.com/UniStuttgart-VISUS/damast/issues/220)).
Resolve an issue with Python API changes that lead to errors in newly-built Docker images ([#221](https://github.com/UniStuttgart-VISUS/damast/issues/221)) by pinning the Docker base image version and using `urllib.parse.urlencode` instead of `werkzeug.urls.url_encode`.
Resolve an issue where the switch between the qualitative and quantitative timeline modes did nothing ([222](https://github.com/UniStuttgart-VISUS/damast/issues/222)).


## v1.2.1

Release date: *2023-08-30*

Resolve an issue in the visualization with the map filters showing an "Add text" option ([#215](https://github.com/UniStuttgart-VISUS/damast/issues/215)).
Resolve an issue in the visualization with the view maximization button not working ([#216](https://github.com/UniStuttgart-VISUS/damast/issues/216)).


## v1.2.0+hotfix-json

Release date: *2023-08-23*

This hotfix resolves an issue with the REST API failing on JSON that returned PostgreSQL numeric range values ([#213](https://github.com/UniStuttgart-VISUS/damast/issues/213)).
The issue was caused by a previous upgrade of Flask to >=2.3 in a Dependabot patch, at which point the API for providing a custom JSON encoder to Flask changed.


## v1.2.0

Release date: *2023-07-26*

This minor release includes migrations to newer versions of some dependencies.
This removes some limitations on the target ECMAScript version and improves tree-shaking capability of the build:

- Upgrade GoldenLayout version from 1.5.9 to 2.6.0 ([#186](https://github.com/UniStuttgart-VISUS/damast/issues/186)).
- Upgrade Tabulator version from 4.8.2 to 5.4.4 ([#187](https://github.com/UniStuttgart-VISUS/damast/issues/187)).
- Upgrade Leaflet version from 1.7.1 to 1.9.4 ([#190](https://github.com/UniStuttgart-VISUS/damast/issues/190)).

The release also includes various smaller bugfixes and some documentation improvements:

- Use stable Wikimedia URLs for the university and funding logos on the home page ([#192](https://github.com/UniStuttgart-VISUS/damast/issues/192)).
- Fix an issue with deleting places using the REST API ([#194](https://github.com/UniStuttgart-VISUS/damast/issues/194)).
- Add a safeguard to the [deploy script](./deploy.sh) for the case that the checked-out repository has no tags ([#196](https://github.com/UniStuttgart-VISUS/damast/issues/196)).
  This could happen on forked repositories, and would lead to the Docker build failing because of an invalid tag name.
  The deploy script now produces a detailed error message, which, alongside the `README` file, describes how to get the upstream tags.
- Fix an issue with builds failing on a fresh check-out of the repository ([#197](https://github.com/UniStuttgart-VISUS/damast/issues/197)).
- Migrate the `CHANGELOG` to a markdown file that is compiled to HTML for the version included in the Docker image ([#201](https://github.com/UniStuttgart-VISUS/damast/issues/201)).
- Fix an issue where selecting a new row in the GeoDB-Editor before it was uploaded would lead to error messages due to loading of non-existent data for dependent tables ([#204](https://github.com/UniStuttgart-VISUS/damast/issues/204)).
- Fix the error appearing on upload of new evidence tuples after tabbing through the evidence row on creation ([#205](https://github.com/UniStuttgart-VISUS/damast/issues/205)).
  The issue was that tabbing through the person instance comment field would change its value from `null` to an empty string.
  Now, the empty string is ignored for the upload.
- Show GeoDB-Editor column name in tooltip when hovering over a cell ([#206](https://github.com/UniStuttgart-VISUS/damast/issues/206)).
- Add possibility to clear GeoDB-Editor column filters for dropdown-type columns ([#207](https://github.com/UniStuttgart-VISUS/damast/issues/207)).
  Fix a representation issue with the place type column filter, which would just show the `place_type_id` as a number.
- Fix a warning with the initial sort configuration for the person GeoDB-Editor page ([#208](https://github.com/UniStuttgart-VISUS/damast/issues/208)).


## v1.1.8

Release date: *2023-05-02*

Fix some inconsistencies and clarify configuration option precedence in the documentation ([#176](https://github.com/UniStuttgart-VISUS/damast/issues/176)).
Change the Docker containers to use non-shared volume mounts instead of shared ones ([#177](https://github.com/UniStuttgart-VISUS/damast/issues/177)).
Update Flask version to mitigate a vulnerability with sessions ([GHSA-m2qf-hxjv-5gpq](https://github.com/advisories/GHSA-m2qf-hxjv-5gpq)).


## v1.1.7

Release date: *2023-03-14*

Update listed publications related to Damast in the root HTML page and the `README`.
Update npm dependencies.
Remove feedback prompt ([#174](https://github.com/UniStuttgart-VISUS/damast/issues/174)).


## v1.1.6

Release date: *2023-01-10*

Fix [CVE-2022-46175](https://github.com/advisories/GHSA-9c47-m6qq-7p4h), remove old, conflicting dependencies to `extract-loader` by inlining HTML template strings into the TypeScript source.


## v1.1.5+history

Release date: *2022-08-23*

Enable history tree feature for all users.


## v1.1.5

Release date: *2022-08-19*

Fix an issue with empty time spans crashing place URI pages ([#166](https://github.com/UniStuttgart-VISUS/damast/issues/166)).
Fix an issue with the false-color scale generation code crashing with zero religious groups visible ([#164](https://github.com/UniStuttgart-VISUS/damast/issues/164)).
Add ticks indicating the time filter start and end year in the horizontal axes of the timeline.


## v1.1.4

Release date: *2022-06-30*

Add a way to go to the place URI pages directly from the map ([#146](https://github.com/UniStuttgart-VISUS/damast/issues/146)).
Highlight hovered religion or confidence level in the timeline tooltip ([#150](https://github.com/UniStuttgart-VISUS/damast/issues/150)).
Add form to navigate to reports by UUID ([#155](https://github.com/UniStuttgart-VISUS/damast/issues/155)).
Add a distributed false-color religion mode ([#158](https://github.com/UniStuttgart-VISUS/damast/issues/158)).
Add buttons to the most-used settings options to the respective views, or the header bar, as well ([#160](https://github.com/UniStuttgart-VISUS/damast/issues/160)).
Add history tree to visualization (beta testers only).
Improve post-login/logout navigation.
Development mode now creates and hosts a PostgreSQL database locally as a Docker container, instead of port-forwarding to a database on a server.
Add a detailed evidence list page for the place URI page.


## v1.1.3+hotfix-wasm-csp

Release date: *2022-05-12*

Add a CSP that fixes the WASM clustering code not being loaded in newer Windows Chromium builds (Edge and Chrome, >=101) ([1](https://bugs.chromium.org/p/v8/issues/detail?id=7041), [2](https://bugs.chromium.org/p/chromium/issues/detail?id=915648)), and thus the map glyphs never appearing in the visualization ([#141](https://github.com/UniStuttgart-VISUS/damast/issues/141)).


## v1.1.3

Release date: *2022-05-05*

Incorporated the new home page design and contents ([#7](https://github.com/UniStuttgart-VISUS/damast/issues/7)).
Fix an issue where Ghostery popup blocker would hide the cookie dialog, but not the background ([#137](https://github.com/UniStuttgart-VISUS/damast/issues/137)).
Fix an issue where the cookie dialog would not work properly in the visualization ([#139](https://github.com/UniStuttgart-VISUS/damast/issues/139)).
Add an extensive documentation PDF.


## v1.1.2

Release date: *2022-05-03*

Make deploy script more versatile and documented.
Use native HTML Dialog element for popups and infoboxes if it is supported ([#98](https://github.com/UniStuttgart-VISUS/damast/issues/98)).
Update info texts and make them more understandable ([#6](https://github.com/UniStuttgart-VISUS/damast/issues/6), [#116](https://github.com/UniStuttgart-VISUS/damast/issues/116), [#117](https://github.com/UniStuttgart-VISUS/damast/issues/117)).
Fix a bug with the positions of annotation suggestions ([#130](https://github.com/UniStuttgart-VISUS/damast/issues/130)).


## v1.1.1

Release date: *2022-04-07*

Centralized the configuration, made configuration via JSON file possible ([#100](https://github.com/UniStuttgart-VISUS/damast/issues/100)).
Fix a bug with brushing and linking sometimes not matching the filtered data ([#101](https://github.com/UniStuttgart-VISUS/damast/issues/101)).
Add sorting options to the source view: by name or evidence count ([#104](https://github.com/UniStuttgart-VISUS/damast/issues/104)).
Improve navigation and page layout on longer pages ([#114](https://github.com/UniStuttgart-VISUS/damast/issues/114)).
Remove necessity for Rust toolchain when building Damast ([#115](https://github.com/UniStuttgart-VISUS/damast/issues/115)).
Fix a bug with loading a visualization state with a complex religion filter ([#119](https://github.com/UniStuttgart-VISUS/damast/issues/119)).
Other minor fixes ([#108](https://github.com/UniStuttgart-VISUS/damast/issues/108), [#113](https://github.com/UniStuttgart-VISUS/damast/issues/113), [#118](https://github.com/UniStuttgart-VISUS/damast/issues/118), [#126](https://github.com/UniStuttgart-VISUS/damast/issues/126)).


## v1.1.0

Release date: *2022-04-01*

Ignore "modifier letter left/right half ring" for place name sorting ([#94](https://github.com/UniStuttgart-VISUS/damast/issues/94)).
Warn about changed underlying data in re-created evicted reports by adding data version history to the report database ([#97](https://github.com/UniStuttgart-VISUS/damast/issues/97)).
Rename the main Python package and all configuration and environment variables from "dhimmis" to "damast" ([#102](https://github.com/UniStuttgart-VISUS/damast/issues/102)).
The source list is now sorted alphabetically as a second key, after evidence count ([#103](https://github.com/UniStuttgart-VISUS/damast/issues/103)).
Various changes to the report format regarding sorting, placement of footnotes, and the like ([#112](https://github.com/UniStuttgart-VISUS/damast/issues/112)).
Add navigation ARIA labels where appropriate.


## v1.0.5

Release date: *2022-02-09*

The server can now be configured to evict old reports ([#61](https://github.com/UniStuttgart-VISUS/damast/issues/61)).
Evicted reports can still be retrieved from the filters, but the report contents need to be regenerated on demand.
Alternative names for places are now sorted first by language, then by transcription and name ([#74](https://github.com/UniStuttgart-VISUS/damast/issues/74)).
The place URI page and reports now contain a "How to Cite" section ([#2](https://github.com/UniStuttgart-VISUS/damast/issues/2), [#56](https://github.com/UniStuttgart-VISUS/damast/issues/56)).
The annotation suggestion refresh jobs can now be configured as to whether and how often they run, and can be triggered manually.
Minor CSS source file restructuring ([#57](https://github.com/UniStuttgart-VISUS/damast/issues/57)).
Fix internal GitHub dependencies to point to public repositories ([`b12a6df`](https://github.com/UniStuttgart-VISUS/damast/pull/59/commits/b12a6df67580e66650b18ab77ea6fac2c0a7af54), [`490611a`](https://github.com/UniStuttgart-VISUS/damast/pull/59/commits/490611a2bbf39265aea232a56fd8f44ecb4193b5)).
Fix a bug with incorrect match sources on place search ([#68](https://github.com/UniStuttgart-VISUS/damast/issues/68)).
Fix a bug with the time filter not being shown correctly in the overview timeline ([#80](https://github.com/UniStuttgart-VISUS/damast/issues/80)).
Fix a vulnerable npm dependency ([CVE-2021-23566](https://github.com/advisories/GHSA-qrpm-p2h7-hrv2)).
Minor fixes ([#66](https://github.com/UniStuttgart-VISUS/damast/issues/66), [#75](https://github.com/UniStuttgart-VISUS/damast/issues/75), [#84](https://github.com/UniStuttgart-VISUS/damast/issues/84)).


## v1.0.4

Release date: *2022-01-18*

The set of map tiles provided as base layers in the maps (visualization, GeoDB-Editor, and place URI page) can now be configured.
A default set is provided.
The religion hierarchy view now uses HTML input elements and has some quality-of-life additions, such as a revert button, subtree toggling, and consistent control icons to the rest of the views ([#34](https://github.com/UniStuttgart-VISUS/damast/issues/34)).
Tag view tooltips now also show a short description, if it exists in the database table ([#17](https://github.com/UniStuttgart-VISUS/damast/issues/17)).
Add a first version of a general visualization documentation page ([#46](https://github.com/UniStuttgart-VISUS/damast/issues/46)).
Fix a bug where the timeline tooltip would be incorrect over the overview when zoomed in to a shorter time range ([#39](https://github.com/UniStuttgart-VISUS/damast/issues/39)).


## v1.0.3

Release date: *2022-01-12*

Add functionality to define which roles a visitor (i.e., not logged in) will receive via an environment variable ([#5](https://github.com/UniStuttgart-VISUS/damast/issues/5)).
Updat and fix some of the unit tests to work properly with the cookie policies introduced in [`v0.19.8`](#v0198).
Fix various smaller issues, including labeling in the reports ([#29](https://github.com/UniStuttgart-VISUS/damast/issues/29)).


## v1.0.2

Release date: *2022-01-10*

Jinja2 templates can now be selectively overridden in an external directory, for example to replace the impressum or title page ([#13](https://github.com/UniStuttgart-VISUS/damast/issues/13)).
External static files can also be hosted.
Fixes *PEP495* warnings from `apscheduler`.
Fixes an issue with loading map states with non-integer zoom levels ([#25](https://github.com/UniStuttgart-VISUS/damast/issues/25)).
Users that are not allowed to see the GeoDB-Editor now have links to the place URI pages from the visualization location list instead.
Adds a button to restore the default confidence selection in the visualization confidence view ([#23](https://github.com/UniStuttgart-VISUS/damast/issues/23)).
Remove some historical clutter and naming.


## v1.0.1

Release date: *2021-12-28*

Renamed the navigation link to the visualization to "Visualization" (from "Prototype"), and renamed references in the sources to "vis" also ([#9](https://github.com/UniStuttgart-VISUS/damast/issues/9)).
Updated default map center and zoom level to better match public dataset extent ([#10](https://github.com/UniStuttgart-VISUS/damast/issues/10)).
Cleaned up and documented clustering radius constants.


## v1.0.0

Release date: *2021-12-21*

Bump version to 1.0.0 for the public release on GitHub.
Prior commits are only available in the [TIK GitHub](https://github.tik.uni-stuttgart.de/frankemx/damast).
Remove some historical clutter, update README files and documentation.


## v0.19.12

Release date: *2021-12-21*

The HTML report and report list now contain a link to the visualization, with the report UUID in the URL fragment.
The visualization will evaluate the fragment, and if it consists of a valid UUID to an existing report, apply the filters from that report on load.


## v0.19.11

Release date: *2021-12-15*

Updated all view infoboxes in the visualization to provide a complete and up-to-date summary of the views' purposes and functionalities.
Update dependencies, and make the development server run in a modified Docker environment that exposes the server source files.
The diversity overlay in the map now shows the correct diversities even for densely populated areas.


## v0.19.10

Release date: *2021-12-09*

Use colored map symbols for the report maps.
Cycle through a set of shapes to ensure differentiability of religions, as colors can be quite similar.
Place sets are now actually used in the report.


## v0.19.9

Release date: *2021-12-08*

The server version is now stored directly in the report filter JSON and the visualization state JSON.
The visualization now also accepts to load only the filter JSON stored on report generation, in which case the rest of the state will remain unchanged.
Report generation now properly fails if no evidences match the current criteria.
Place set filters are now listed in the query description of reports.


## v0.19.8

Release date: *2021-12-08*

More strict IP logging, add cookie and `localStorage` consent functionalities to comply with GDPR rules.


## v0.19.7

Release date: *2021-12-07*

Smaller bugfixes.
All exceptions and errors during runtime are now logged to the error log.


## v0.19.6

Release date: *2021-11-25*

The location list now shows how the current location confidence filter affects the locations, and also what location confidence they have.
The location list now also has a filtering functionality, where a place set can be specified.
Place sets can also be saved in the database.


## v0.19.5

Release date: *2021-11-09*

Update the title page content.


## v0.19.4

Release date: *2021-11-09*

Speed up unit tests, make server more resilient to the number of reverse proxies it lies behind.


## v0.19.3

Release date: *2021-11-02*

Add CHANGELOG to repository and to server.


## v0.19.2

Release date: *2021-11-02*

Improve evidence REST endpoint to reduce the number of HTTP requests sent when opening the GeoDB-Editor.


## v0.19.1

Release date: *2021-11-02*

Improve the way messages from the server, such as "Log-in successful", are rendered into the page, and how they are removed after a few seconds.


## v0.19.0

Release date: *2021-11-02*

This release restructures the user/role mapping of the server considerably. 
Until now, there was a general `user` role that could do most things, and some additional specialty roles with higher privileges.
The new system has roles with three aspects:

 - General access level: `user`, `dev`, and `admin`.
 - Database access: `readdb` and `writedb`, where reading access to the database is differentiated from writing access.
 - Access to different functionalities: `vis`, `geodb`, `annotator`, `reporting`, and `pgadmin`.

The respective unit tests and test fixtures were also modified to reflect the new structure, and a few new test users were created for different role combinations.


## v0.18.10

Release date: *2021-10-22*

Make recalculation of annotation suggestions dependent on whether anything changed since the last calculation.


## v0.18.9

Release date: *2021-10-22*

Existing annotation documents are now regularly scanned for potential annotation suggestions.
For this, existing names of places, persons, and religions are considered, as well as existing annotations in the same document.
The suggestions are displayed separately in the annotator, and can be taken on as new annotations in two clicks.
This release also fixes some issues with the PDF report regarding connected text in Arabic names, as well as LTR/RTL mixing issues.


## v0.18.8

Release date: *2021-10-11*

Add a PDF version of the report, using LaTeX.
As report creation now takes longer, reports are created in separate processes.
The PDF version is also retrievable using the UUID of the report.


## v0.18.7

Release date: *2021-10-04*

HTML documents for annotation are now sanitized on upload.
The annotator page now contains documentation about how to prepare the document.


## v0.18.6

Release date: *2021-09-30*

Creating a report now also creates a PDF map, using `pyplot`.
Each report now gets a UUID, and reports can be retrieved later on as long as they are persisted on the server.
Reports are now stored in a SQLite3 database, and the size limitation on how many evidences are included in the report is removed.
The report generation is done asynchronously now, and the result page shows a spinner during this time.
A separate page lists all reports the user can see.


## v0.18.5

Release date: *2021-09-29*

Move the entire server stuff into a Docker container.
The container is built and can then be deployed easily to new hosts as a `tar` file using `docker save` and `docker load`.


## v0.18.4

Release date: *2021-09-24*

The advanced religion filter in the visualization is now performed client-side.
This simplifies some code both in the server and the front end.
The infobox text and the filter verbalization were updated.


## v0.18.3

Release date: *2021-09-21*

Add place search functionality to the place URI endpoint.


## v0.18.2

Release date: *2021-09-20*

Add a place endpoint which shows data about only the place.
This will later be used for the place URIs.


## v0.18.1

Release date: *2021-09-17*

Add map mode without clustering.
This mode shows smaller icons with one circle for each religious denomination, with the circles arranged in a hexagonal grid pattern.
The map icons can overlap in this mode, and the mode is stored in the visualization state.


## v0.17.13

Release date: *2021-09-16*

Minor improvements to visualization.


## v0.17.12

Release date: *2021-09-16*

Minor improvements to GeoDB-Editor.


## v0.17.11

Release date: *2021-09-16*

Minor fixes to GeoDB-Editor.


## v0.17.10

Release date: *2021-09-13*

Use the qualitative timeline by default.
Show the placed locations before the unplaced by default.


## v0.17.9

Release date: *2021-09-01*

Add functionality to describe the currently active filters from within the visualization.
This re-uses the same text that is shown in the report as well.


## v0.17.8

Release date: *2021-08-31*

Make the WASM clustering code for the map an [external dependency](https://github.tik.uni-stuttgart.de/frankemx/wasm-clustering).


## v0.17.7

Release date: *2021-08-30*

Clean up and fix some minor issues with the timeline.


## v0.17.6

Release date: *2021-08-27*

Add a qualitative timeline.
Instead of showing a quantitative stacked area chart for the number of evidences per religion (or confidence level) for each year, this shows a Gantt chart of whether or not there are evidences in that year for each religion (or confidence level).
The timeline mode is also stored with the visualization state.


## v0.17.5

Release date: *2021-08-26*

Clean up database dump compression.


## v0.17.4

Release date: *2021-08-23*

Clean up server configuration.


## v0.17.3

Release date: *2021-08-20*

Add GeoJSON polygon filters to the visualization.
These restrict the geographical locations of the evidence shown.
The filters are also described in and applied to the reports.


## v0.17.2

Release date: *2021-08-19*

Misc fixes and tweaks.
Add linking of evidence from annotator to GeoDB-Editor.


## v0.17.1

Release date: *2021-08-19*

Implement new annotator feature.
The annotator has the functionality to add annotations of different types to digital documents, and to link together such annotations to evidences.
This version also includes functionality to upload new documents for annotations, as well as an extensive documentation.
It is now also possible to edit the positions of existing annotations.

Add reporting functionality.
This generates a textual description of the filters applied to the data, and lists the places, religions, persons, and evidence matching those filters in the database.

Add some quality-of-life features to the visualization, such as row- and column-wise selection and deselection of confidence levels.
Split up the GeoDB-Editor to show a separate page for person-related tables.
Add links between visualization, GeoDB-Editor, and annotator.


## v0.16.3

Release date: *2021-06-11*

Minor fixes to timeline.


## v0.16.2

Release date: *2021-06-01*

Cleanup, bug fixes, locale-aware location list sorting.


## v0.16.1

Release date: *2021-05-18*

Bug fixes and improvements.


## v0.16.0

Release date: *2021-05-17*

Add a settings pane to the visualization.
This pane provides the functionality for saving and loading visualization states.
Further, the layout of the GoldenLayout tiles can be saved in `localStorage`.


## v0.15.6

Release date: *2021-05-10*

Make "no value" for confidence selectable in GeoDB-Editor tables.


## v0.15.5

Release date: *2021-05-06*

Smaller tweaks and fixes.


## v0.15.4

Release date: *2021-04-14*

Add more person table functionality to GeoDB-Editor.


## v0.15.3

Release date: *2021-04-13*

Add external place and person URIs, add person columns and tables to GeoDB-Editor.


## v0.15.2

Release date: *2021-04-07*

More unit tests, tweaks to REST endpoints.


## v0.15.1

Release date: *2021-04-07*

Improve search for place names, tweak and add unit tests.


## v0.15.0

Release date: *2021-04-07*

Better name search for places with non-Latin scripts.
Here, the reverse proxy garbled the URL parameters because of an encoding issue.
The search data is now sent as the request body.


## v0.14.9

Release date: *2021-04-07*

Minor tweaks.


## v0.14.8

Release date: *2021-02-16*

Minor performance improvement to map zoom in the visualization.


## v0.14.7

Release date: *2021-02-16*

Minor tweaks, continue migration to D3 v6.


## v0.14.6

Release date: *2021-02-16*

Minor tweaks, begin migration to D3 v6.


## v0.14.5

Release date: *2021-02-15*

Minor tweaks.


## v0.14.4

Release date: *2021-01-26*

Tweak and improve unit tests.


## v0.14.3

Release date: *2021-01-20*

Add info box links to the GoldenLayout view headers.


## v0.14.2

Release date: *2021-01-19*

Store core evidence view as a materialized view in the PostgreSQL database.
This improves the loading time of the visualization drastically, but necessitates regular rebuilding of the materialized view.


## v0.14.1

Release date: *2021-01-19*

Indicate unapplied filter changes in visualization view headers.


## v0.14.0

Release date: *2021-01-19*

Add more functionality for tagging evidences, as well as a tag view in the visualization.


## v0.13.0

Release date: *2021-01-13*

Move visualization views to GoldenLayout to provide resizable views and tabbing.


## v0.12.4

Release date: *2021-01-11*

Minor bug fixes.


## v0.12.2

Release date: *2020-12-09*

Move map clustering to Rust WASM code.


## v0.12.1

Release date: *2020-12-07*

Add tag table to GeoDB-Editor, misc tweaks.


## v0.12.0

Release date: *2020-11-26*

Add tagging functionality to evidences.


## v0.11.3

Release date: *2020-11-11*

Add a diversity heatmap to the visualization.


## v0.11.2

Release date: *2020-10-29*

Improvements to annotation REST API.


## v0.11.1

Release date: *2020-10-15*

Misc tweaks to compression of server responses.


## v0.11.0

Release date: *2020-10-14*

Move a lot of visualization logic to multiple WebWorkers, one per view.


## v0.10.4

Release date: *2020-10-08*

Cleanup.


## v0.10.3

Release date: *2020-10-08*

Migrate some visualization filter logic to WebWorkers.


## v0.10.2

Release date: *2020-10-05*

Misc fixes to server and tests, add `README`.


## v0.10.1

Release date: *2020-09-21*

Add annotation constraints for document length.
Add default confidence filter selection in visualization.


## v0.10.0

Release date: *2020-09-21*

Add more unit tests.


## v0.9.10

Release date: *2020-08-24*

Add a lot of unit tests for the REST API.


## v0.9.9

Release date: *2020-08-14*

Misc bug fixes, add first pytest tests.


## v0.9.8

Release date: *2020-08-12*

Cleanup database dump utility.


## v0.9.7

Release date: *2020-08-12*

Red border on GeoDB-Editor deletion modal.


## v0.9.6

Release date: *2020-08-12*

Tweaks to userlog and login page.


## v0.9.5

Release date: *2020-08-11*

Tweaks to versioning code.


## v0.9.4

Release date: *2020-08-11*

Misc tweaks, reset brushing when zooming the map.


## v0.9.3

Release date: *2020-08-06*

Misc tweaks, improve greyed-out filters in visualization.


## v0.9.2

Release date: *2020-08-04*

First version of a root page introducing the project.


## v0.9.1

Release date: *2020-08-04*

Expire logins.


## v0.9.0

Release date: *2020-08-03*

Add the sources view to the visualization.


## v0.8.3

Release date: *2020-07-30*

Minor tweaks, improvements on database migration script.
Show a label in the testing instance.


## v0.8.2

Release date: *2020-07-28*

Add database dump endpoint.


## v0.8.1

Release date: *2020-07-28*

Add documentation features: database schema PDF, user log, REST API documentation.


## v0.8.0

Release date: *2020-07-22*

Add testing database.


## v0.7.8

Release date: *2020-07-21*

Start DB migration preparation, misc tweaks.


## v0.7.7

Release date: *2020-07-21*

Minor fixes, rename confidence level "confident" to "probable".


## v0.7.6

Release date: *2020-07-14*

Prettier coordinate formatting, misc tweaks.


## v0.7.5

Release date: *2020-07-14*

Add CSS compression.


## v0.7.4

Release date: *2020-07-13*

Cleanup SCSS.


## v0.7.3

Release date: *2020-07-13*

Link to GeoDB-Editor from the location list of the visualization.


## v0.7.2

Release date: *2020-07-09*

FontAwesome icons in header and footer links.


## v0.7.1

Release date: *2020-07-09*

Add loading spinner.


## v0.7.0

Release date: *2020-07-09*

Replace old by new visualization prototype.
Include real confidence data in the visualization, remove dummy data.


## v0.6.14

Release date: *2020-07-07*

More consistent CSS and buttons, add FontAwesome to login/logout buttons.


## v0.6.13

Release date: *2020-07-07*

Unify style sheets to common SCSS build.


## v0.6.12

Release date: *2020-07-03*

Ignore Arabic definite articles when sorting the place table.


## v0.6.11

Release date: *2020-07-03*

Minor fixes.


## v0.6.10

Release date: *2020-07-03*

Minor fixes.


## v0.6.9

Release date: *2020-07-03*

Add logic regarding unsaved changes to GeoDB-Editor.


## v0.6.8

Release date: *2020-07-03*

Implement new version of GeoDB-Editor.


## v0.6.6

Release date: *2020-06-10*

Log blueprint in access log, fix deploy.


## v0.6.5

Release date: *2020-06-09*

Anonymize IP addresses in access log.


## v0.6.4

Release date: *2020-06-09*

Add rotating logs, small tweaks.


## v0.6.3

Release date: *2020-06-09*

Use a common base Jinja2 template for pages.


## v0.6.2

Release date: *2020-06-08*

Cleanup.


## v0.6.1

Release date: *2020-06-08*

Put visualization behind login.


## v0.6.0

Release date: *2020-06-08*

Combine multiple functionalities in one Flask server.
Improve REST API to the database.
Introduce the advanced religion filter mode, where combinations of religions must be present in the same place.


## v0.5.0

Release date: *2020-01-10*

Add live database access and first version of REST API.
Change religion hierarchy to an indented tree visualization.


## v0.4.12

Release date: *2019-11-05*

Bug fixes.


## v0.4.11

Release date: *2019-10-18*

Color scale tweaks.


## v0.4.10

Release date: *2019-08-09*

Add cache control.


## v0.4.9

Release date: *2019-08-09*

More hard-coded data.


## v0.4.8

Release date: *2019-08-05*

Better linking in location list.


## v0.4.7

Release date: *2019-08-05*

Bug fixes, deploy script.


## v0.4.6

Release date: *2019-07-25*

Minor fixes.


## v0.4.5

Release date: *2019-07-24*

Add alternative names to location search.


## v0.4.4

Release date: *2019-07-24*

New confidence color scheme, package updates.


## v0.4.3

Release date: *2019-07-23*

Add multiple map styles.


## v0.4.2

Release date: *2019-07-23*

Add information modals for more views.


## v0.4.1

Release date: *2019-07-22*

Add info modal for religion hierarchy.


## v0.4.0

Release date: *2019-07-22*

Cleanup, bug fixes and improvements on orthogonal filtering and uncertainty visualization mode.


## v0.3.4

Release date: *2019-07-16*

Untimed display is now affected by filters.


## v0.3.3

Release date: *2019-07-15*

Minor visual tweaks.


## v0.3.2

Release date: *2019-07-04*

Clicking in the location list moves the map to the location.


## v0.3.1

Release date: *2019-07-01*

Smaller bug fixes.
Add search field to location list.


## v0.3.0

Release date: *2019-05-29*

Add uncertainty coloring mode to visualization.


## v0.2.6

Release date: *2019-04-16*

Add functionality to swap location list positions, and to collapse them.


## v0.2.5

Release date: *2019-04-10*

Add untimed data view, as well as a list of places without coordinates.


## v0.2.4

Release date: *2019-04-05*

Add list of locations.


## v0.2.3

Release date: *2019-04-04*

Add brushing, "only active" option for brushing.


## v0.2.2

Release date: *2019-04-03*

Add more data (hard-coded).


## v0.2.1

Release date: *2019-02-25*

Initial version of visualization and Flask app.

