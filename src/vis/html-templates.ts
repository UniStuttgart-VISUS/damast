/**
  * This file contains the innerHTML strings that were previously loaded via
  * `html-loader` in the build process. After some issues with vulnerable
  * versions of json5 (CVE-2022-46175) that could not be automatically
  * resolved, these strings were moved here to JavaScript to remove the
  * `html-loader` (and `file-loader`) dependency.
  */

// template for html/confidence.template.html
export const confidence = `
<div class="confidence__header">
  <span class="button-checkbox" title="Use an aspect of confidence (select column with the eye symbol below) for coloring. See the info text of this view and the settings pane for more details.">
    <input type="checkbox" id="use-confidence-color">
    <label for="use-confidence-color">Color</label>
  </span>
  <button id="confidence-filter-none" class="confidence__controls button button--white" title="Deselect all checkboxes"><i class="fa fa-lg fa-circle-o"></i></button>
  <button id="confidence-filter-invert" class="confidence__controls button button--white" title="Invert checkbox selection"><i class="fa fa-lg fa-rotate-90 fa-exchange"></i></button>
  <button id="confidence-filter-all" class="confidence__controls button button--white" title="Select all checkboxes"><i class="fa fa-lg fa-dot-circle-o"></i></button>
  <button id="confidence-filter-default" class="confidence__controls button button--white" title="Revert to default selection"><i class="fa fa-lg fa-undo"></i></button>
  <button id="confidence-filter-apply" class="confidence__controls button button--accent">Apply</button>
</div>
<div id="confidence"></div>
`;

// template for html/confirmation-report-generation.template.html
export const confirmation_report_generation = `
<p>
You are requesting to generate a report with
<strong id="evidence-count"></strong>&nbsp;pieces of evidence and
<strong id="place-count"></strong>&nbsp;places.
<span id="extra-sentence"></span>
</p>

<p>
We try to keep all reports available via their UUID or URL indefinitely.
Generating a report takes time, puts load on the server, and uses up storage space on the server.
Please only use this feature if you are sure you will use the generated report.
Consider using the tooltips, and the links to the place URI pages in the location list and map
(press <kbd class="shift-button">Shift</kbd> and click on a map symbol at the same time), instead to get details on demand.
</p>

<form method="dialog">
  <div class="vertical-fill-buttons">
    <button
        value="no"
        id="nevermind-no-report"
        class="button button--medium">
      <i class="fa fa-fw fa-times"></i>
      Nevermind, do not generate the report.
    </button>
    <button
        value="yes"
        id="yes-report"
        class="button button--medium button--blue">
      <i class="fa fa-fw fa-file-text-o"></i>
      I understand. Please generate the report.
    </button>
  </div>
</form>
`;

// template for html/location-list.template.html
export const location_list = `
<div class="location-list__search-bar">
  <i class="fa fa-fw fa-search search-bar__icon"></i>
  <input class="search-bar__input" type="text" placeholder="Search name">
  <button class="search-bar__clear-button search-bar__clear-button--hidden">
    <i class="fa fa-times fa-fw"></i>
  </button>
</div>

<details class="location-list__filter">
  <summary>
    <h2 class="location-list__title">Place Filter</h2>
  </summary>

  <section class="filter__header">
    <button id="place-filter-revert" class="button button--white" title="Revert place set to currently shown filters"><i class="fa fa-lg fa-history"></i></button>
    <button id="place-filter-none" class="button button--white" title="Deselect all places"><i class="fa fa-lg fa-circle-o"></i></button>
    <button id="place-filter-invert" class="button button--white" title="Invert place selection"><i class="fa fa-lg fa-rotate-90 fa-exchange"></i></button>
    <button id="place-filter-all" class="button button--white" title="Select all places"><i class="fa fa-lg fa-dot-circle-o"></i></button>

    <button id="extend-place-set" class="button button--white button--svgicon" title="Extend the place set by all places in the place list (UNION)">
      <svg width="22" height="12" viewBox="0 2 22 12">
        <circle cx="14" cy="8" r="6" fill="currentColor" />
        <circle cx="8" cy="8" r="6" fill="currentColor" />
      </svg>
    </button>
    <button id="restrict-place-set" class="button button--white button--svgicon" title="Restrict the place set to the places that are currently in the place set AND are in the place list (INTERSECTION)">
      <svg width="22" height="12" viewBox="0 2 22 12">
        <clipPath id="circle2-clip">
          <circle cx="14" cy="8" r="6" />
        </clipPath>
        <circle cx="14" cy="8" r="5.5" fill="currentColor" stroke="currentColor" stroke-width="1" fill-opacity="0.2" />
        <circle cx="8" cy="8" r="5.5" fill="currentColor" stroke="currentColor" stroke-width="1" fill-opacity="0.2" />
        <circle cx="8" cy="8" r="6" fill="currentColor" clip-path="url(#circle2-clip)" />
      </svg>
    </button>
    <button id="remove-from-place-set" class="button button--white button--svgicon" title="Remove all places from the place set that are currently in the place list (SET SUBTRACTION)">
      <svg width="22" height="12" viewBox="0 2 22 12">
        <mask id="circle2-mask">
          <circle cx="8" cy="8" r="6" fill="white" />
          <circle cx="14" cy="8" r="6" fill="black" />
        </mask>
        <circle cx="14" cy="8" r="5.5" fill="currentColor" stroke="currentColor" stroke-width="1" fill-opacity="0.2" />
        <circle cx="8" cy="8" r="6" fill="currentColor" mask="url(#circle2-mask)" />
      </svg>
    </button>
    <button id="apply-place-set" class="button button--accent" disabled>Apply</button>
  </section>

  <section class="filter__content"></section>

  <section class="filter__footer">
    <button id="save-place-set" class="button">
      <i class="fa fa-fw fa-upload fa--pad-right"></i>
      Save
    </button>
    <button id="load-place-set" class="button">
      <i class="fa fa-fw fa-download fa--pad-right"></i>
      Load
    </button>
  </section>
</details>

<hr style="width:clamp(20px,50%,100px)">

<div class="location-list__scrollarea">
  <details class="location-list container__location-list__placed" open>
    <summary>
      <h2 class="location-list__title">Placed</h2>
      <button class="location-list-swap-button"><i class="fa fa-fw fa-arrows-v"></i></button>
    </summary>

    <div class="location-list__content"></div>
  </details>

  <details class="location-list container__location-list__unplaced" open>
    <summary>
      <h2 class="location-list__title">Unplaced</h2>
      <button class="location-list-swap-button"><i class="fa fa-fw fa-arrows-v"></i></button>
    </summary>

    <div class="location-list__content"></div>
  </details>
</div>
`;

// template for html/map.template.html
export const map = `
<div id="map"></div>
`;

// template for html/questionnaire-intro.template.html
export const questionnaire_intro = `
<p>
  You seem to have used <span class="small-caps">Damast</span> for some time now.
  We would be very interested in receiving some feedback from you.
  This feedback will be used to improve <span class="small-caps">Damast,</span> to extend <span class="small-caps">Damast</span> to new fields of research and data sets, and in scientific publications regarding <span class="small-caps">Damast.</span>
</p>

<p>
  Providing feedback is completely optional, and your feedback would only be published in anonymized form.
  If you do not want to participate, click <em><q>No thanks</q></em>, and we will not ask you again in this browser.
  If you want to be asked again, but not in this session, click <em><q>Maybe later</q></em>.
  Otherwise, click <em><q>Provide feedback</q></em> to proceed to the questionnaire.
</p>

<div class="vertical-fill-buttons">
  <button
      role="button"
      id="no-thanks"
      class="button button--medium button--red"
      title="I do not want to provide feedback. Please do not ask me again.">
    <i class="fa fa-fw fa-times"></i>
    No thanks
  </button>
  <button
      role="button"
      id="not-now"
      class="button button--medium"
      title="I do not want to provide feedback. Please ask me again next time.">
    <i class="fa fa-fw fa-clock-o"></i>
    Maybe later
  </button>
  <button
      role="button"
      id="yes"
      class="button button--medium button--blue"
      title="I do not want to provide feedback. Please ask me again next time.">
    <i class="fa fa-fw fa-pencil-square-o"></i>
    Provide feedback
  </button>
</div>
`;

// template for html/religion.template.html
export const religion = `
<div class="hierarchy__header">
  <span class="button-checkbox" title="Distribute religion colors evenly. Better readability with few religions shown, but no consistency across states. See the settings pane for more details.">
    <input type="checkbox" id="use-falsecolor">
    <label for="use-falsecolor">False color</label>
  </span>
  <button id="religion-filter-revert" class="hierarchy__controls button button--white" title="Revert filters"><i class="fa fa-lg fa-history"></i></button>
  <div class="hierarchy__controls" id="hierarchy-filter-controls">
    <label class="switch__label" for="hierarchy-filter-mode">Simple</label>
    <label class="switch">
      <input type="checkbox" id="hierarchy-filter-mode">
      <span class="slider round"></span>
    </label>
    <label class="switch__label" for="hierarchy-filter-mode">Advanced</label>
  </div>
  <button id="hierarchy-apply" class="confidence__controls button button--accent">Apply</button>
</div>
<div class="hierarchy" style="--num-columns:5">
</div>
`;

// template for html/settings-pane.template.html
export const settings_pane = `
<section>
  <h4>Visualization Settings</h4>

  <dl>
    <dt>Show filtered data</dt>
    <dd>
      <details>
        <summary>Show only filtered data</summary>
        <p>
        This switch controls if data which does not match the currently selected filters is also visualized.
        If <em><q>All data</q></em> is selected, non-matched data is represented by less saturated colors.
        </p>
      </details>
      <div class="timeline__controls" id="only-active-controls">
        <label class="switch__label" for="check-only-active">All data</label>
        <label class="switch">
          <input type="checkbox" id="check-only-active">
          <span class="slider round"></span>
        </label>
        <label class="switch__label" for="check-only-active">Only active</label>
      </div>
    </dd>
    <dt>Display mode</dt>
    <dd>
      <details>
        <summary>Show religion or confidence</summary>
        <p>
          This switch controls which aspect of the data is mapped to color.
          If <em><q>Religion</q></em> is selected, the religion is used for coloring, using the color scheme in the <strong>Religion</strong> tab.
          If <em><q>Confidence</q></em> is selected, the level of confidence is used, using the color scheme in the <strong>Confidence</strong> tab.
          The <em>aspect of confidence</em> used can be selected in the <strong>Confidence</strong> tab as well, and the currently used aspect is indicated with an
          <i class="fa fa-eye"></i>
          eye symbol below the column.
        </p>
      </details>
      <div class="timeline__controls" id="confidence-controls">
        <label class="switch__label" for="confidence-mode">Religion</label>
        <label class="switch">
          <input type="checkbox" id="confidence-mode">
          <span class="slider round"></span>
        </label>
        <label class="switch__label" for="confidence-mode">Confidence</label>
      </div>
    </dd>
    <dt>False coloring</dt>
    <dd>
      <details>
        <summary>Use false coloring for religions</summary>
        <p>
          This switch controls whether a consistent color scheme is used for religions, or a <em>false-color</em> scheme.
          The former uses the colors defined for each religion in the database, resulting in consistent coloring over time.
          The latter tries to distribute the colors of currently-visible religions as well as possible.
          This coloring is easier to distinguish, but is not consistent if the set of visible religions changes.
          For screenshots and comparisons, we recommend using the consistent coloring from the database.
        </p>
      </details>
      <div class="timeline__controls" id="falsecolor-controls">
        <label class="switch__label" for="falsecolor">Consistent</label>
        <label class="switch">
          <input type="checkbox" id="falsecolor">
          <span class="slider round"></span>
        </label>
        <label class="switch__label" for="falsecolor">False color</label>
      </div>
    </dd>
    <dt>Timeline mode</dt>
    <dd>
      <details>
        <summary>Show qualitative or quantitative timeline</summary>
        <p>
          This switch controls whether the timeline shows a qualitative summary or quantitative information.
          If <em><q>Quantitative</q></em> is selected, the number of pieces of evidence of that type in that year is encoded into the height of the area.
          If <em><q>Qualitative</q></em> is selected, the timeline only shows <em>whether</em> there is evidence of that type each year.
        </p>
      </details>
      <div class="timeline__controls" id="timeline-mode-controls">
        <label class="switch__label" for="timeline-mode">Quantitative</label>
        <label class="switch">
          <input type="checkbox" id="timeline-mode">
          <span class="slider round"></span>
        </label>
        <label class="switch__label" for="timeline-mode">Qualitative</label>
      </div>
    </dd>
    <dt>Map mode</dt>
    <dd>
      <details>
        <summary>Toggle clustering of places</summary>
        <p>
          This switch controls whether the map shows large, detailed symbols for clusters of location without overlap, or one smaller symbol per place.
          The latter mode may lead to overlap of symbols and should be used at one's own peril.
        </p>
      </details>
      <div class="timeline__controls" id="map-mode-controls">
        <label class="switch__label" for="map-mode">Clustered</label>
        <label class="switch">
          <input type="checkbox" id="map-mode">
          <span class="slider round"></span>
        </label>
        <label class="switch__label" for="map-mode">Unclustered</label>
      </div>
    </dd>
  </dl>
</section>

<section>
  <h4>Generate Report</h4>

  <p>
    You can generate a detailed text report of all the data visible under the currently selected filters.
    This report will show up in a new tab.
    Be careful not to do this with very broad filter criteria, as the report will get very long in that case.
    If the result set is too large, the server will refuse to build the report.
    Alternatively, you can just get a description of the currently active filters within the visualization.
  </p>

  <div class="buttons">
    <button class="button button--smallish" id="generate-report">
      <i class="fa fa-print fa--pad-right"></i>
      Generate report
    </button>

    <button class="button button--smallish" id="describe-filters">
      <i class="fa fa-info fa--pad-right"></i>
      Describe filters
    </button>
  </div>
</section>

<section>
  <h4>Layout Settings</h4>

  You can save the current layout.
  This setting will only persist for your current browser and computer (using <code>localStorage</code>).
  You can also reset to the initial layout (<em>Note:</em> this will reload the page).

  <div class="buttons">
    <button class="button button--smallish" id="save-layout">
      <i class="fa fa-save fa--pad-right"></i>
      Save current layout
    </button>
    <button class="button button--smallish button--red" id="reset-layout">
      <i class="fa fa-undo fa--pad-right"></i>
      Reset layout
    </button>
  </div>
</section>

<section id="persist">
  <h4>Persist State</h4>

  You can also save the current state of the visualization.
  In particular, this will save the <em>filters</em> you currently have applied, the center point and zoom level of the <em>map,</em> and the <em>visualization settings</em> applied above.
  These settings are <span class="no-break"><i class="fa fa-download"></i> <em>downloaded</em></span> as a file to your computer.
  You can <span class="no-break"><i class="fa fa-upload"></i> <em>upload</em></span> such a file later to restore the state.

  <div class="buttons">
    <button class="button button--smallish" id="save-state">
      <i class="fa fa-download fa--pad-right"></i>
      Save visualization state
    </button>

    <input id="load-file" class="hidden" type="file" accept="application/json">
    <button class="button button--smallish" id="load-state">
      <i class="fa fa-upload fa--pad-right"></i>
      Load visualization state
    </button>
  </div>
</section>
`;

// template for html/sources.template.html
export const sources = `
<div class="source__header">
  <button id="sources-filter-none" class="confidence__controls button button--white" title="Deselect all checkboxes"><i class="fa fa-lg fa-circle-o"></i></button>
  <button id="sources-filter-invert" class="confidence__controls button button--white" title="Invert checkbox selection"><i class="fa fa-lg fa-rotate-90 fa-exchange"></i></button>
  <button id="sources-filter-all" class="confidence__controls button button--white" title="Select all checkboxes"><i class="fa fa-lg fa-dot-circle-o"></i></button>
  <div class="hierarchy__controls" id="source-sort-controls">
    <label class="switch__label" for="source-sort-mode">
      Name
      <i class="fa fa-lg fa-fw fa-sort-alpha-asc"></i>
    </label>
    <label class="switch">
      <input type="checkbox"
             id="source-sort-mode"
             title="Sort list primarily by short name (alphabetically), or by number of pieces of evidences (descending)">
      <span class="slider round"></span>
    </label>
    <label class="switch__label" for="source-sort-mode">
      <i class="fa fa-lg fa-fw fa-sort-numeric-desc"></i>
      Count
    </label>
  </div>
  <button id="sources-filter-apply" class="confidence__controls button button--accent">Apply</button>
</div>
<div id="sources" class="source__body"></div>
`;

// template for html/tags.template.html
export const tags = `
<div class="tags__header">
  <button id="tags-filter-none" class="confidence__controls button button--white" title="Deselect all checkboxes"><i class="fa fa-lg fa-circle-o"></i></button>
  <button id="tags-filter-invert" class="confidence__controls button button--white" title="Invert checkbox selection"><i class="fa fa-lg fa-rotate-90 fa-exchange"></i></button>
  <button id="tags-filter-all" class="confidence__controls button button--white" title="Select all checkboxes"><i class="fa fa-lg fa-dot-circle-o"></i></button>
  <div class="hierarchy__controls" id="tags-sort-controls">
    <label class="switch__label" for="tags-sort-mode">
      Name
      <i class="fa fa-lg fa-fw fa-sort-alpha-asc"></i>
    </label>
    <label class="switch">
      <input type="checkbox"
             id="tags-sort-mode"
             title="Sort list primarily by tag name (alphabetically), or by number of pieces of evidences (descending)">
      <span class="slider round"></span>
    </label>
    <label class="switch__label" for="tags-sort-mode">
      <i class="fa fa-lg fa-fw fa-sort-numeric-desc"></i>
      Count
    </label>
  </div>
  <button id="tags-filter-apply" class="confidence__controls button button--accent">Apply</button>
</div>
<div id="tags" class="tags__body"></div>
`;

// template for html/timeline.template.html
export const timeline = `
<div class="timeline__header">
  <div class="hierarchy__controls" id="timeline-mode-controls"
    title="Switch between qualitative and quantitative mode for the timeline. See the info box of this view and the settings pane for more details.">
    <label class="switch__label" for="timeline-mode">
      <i class="fa fa-fw fa-area-chart"></i>
      Quantitative
    </label>
    <label class="switch">
      <input type="checkbox" id="timeline-mode">
      <span class="slider round"></span>
    </label>
    <label class="switch__label" for="timeline-mode">
      Qualitative
      <i class="fa fa-fw fa-bar-chart-o" style="filter:none;transform:rotate(90deg)scaleX(-1)"></i>
    </label>
  </div>
</div>
<div class="svg-container">
  <svg id="timeline" class="stacked-histogram"></svg>
</div>
`;

// template for html/untimed.template.html
export const untimed = `
<div class="svg-container">
  <svg class="container__timeline-untimed__svg" id="untimed"></svg>
</div>
`;

