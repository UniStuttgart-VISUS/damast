/**
 * The radius of one clustered map glyph. Two map glyphs are guaranteed not to
 * be closer together than `2 * radius`. The glyph itself will have a radius
 * slightly smaller than `radius`, and an invisible area of interaction with
 * exactly the radius of `radius`.
 */
export const radius = 24;

/**
 * The radius of religion symbols in the unclustered mode of the map.
 */
export const unclustered_radius = 4;

/**
 * Default zoom level of the map. This is chosen to fit the public data into
 * the map with the default visualization layout on a 1920x1080 screen with a
 * maximized browser window.
 */
export const zoom_level = 4.5;

/**
 * Default center (lat, lng) of the map. This is chosen to fit the public data
 * into the map with the default visualization layout on a 1920x1080 screen
 * with a maximized browser window.
 */
export const center: [number, number] = [28.7, 48.9];
