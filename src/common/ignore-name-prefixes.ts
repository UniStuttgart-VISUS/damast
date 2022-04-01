// collection of apostrophe-like characters to ignore for sorting
const _apostrophe_like = [
  `'`,        // U+0027 APOSTROPHE [used in simple transcription for both ʿain and hamza]
  `\u02bf`,   // U+02BF ʿ MODIFIER LETTER LEFT HALF RING [used in scientific transcription for ʿain]
  `\u02be`,   // U+02BE ʾ MODIFIER LETTER RIGHT HALF RING [used in scientific transcription for hamza]
].join('');

/**
 * This is a regex of prefixes for location names the sort function should
 * ignore. Possible components are the Arabic definite article (e.g., "al-" in
 * "al-Baramun") and the apostrophe-like characters listed above.
 */
const sort_ignore_name_prefixes = RegExp(`^(a([tdrzsṣḍṭẓln]|[tds]h)-[${_apostrophe_like}]?|[${_apostrophe_like}])`);;

export default sort_ignore_name_prefixes;
