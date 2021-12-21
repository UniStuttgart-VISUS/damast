/**
 * This is a regex of prefixes for location names the sort function should
 * ignore. Possible components:
 *
 *  - arabic definite article (e.g., "al-" in "al-Baramun")
 *  - voiced pharyngeal fricative ("'") at the start of the name
 */
const sort_ignore_name_prefixes = /^(a([tdrzsṣḍṭẓln]|[tds]h)-[’']?|[’'])/;

export default sort_ignore_name_prefixes;
