import * as T from './datatypes';

const default_selection: T.ConfidenceSelection = {
    'time_confidence': ['certain', 'probable'],
    'location_confidence': ['certain', 'probable', 'contested', 'uncertain', 'false', null],
    'place_attribution_confidence': ['certain', 'probable'],
    'source_confidences': ['certain', 'probable'],
    'interpretation_confidence': ['certain', 'probable'],
    'religion_confidence': ['certain', 'probable']
};

export default default_selection;
