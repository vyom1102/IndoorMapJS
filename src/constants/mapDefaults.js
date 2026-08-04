/** Default map center [lng, lat] before venue API loads — geographic centre of India */
export const DEFAULT_MAP_CENTER = [78.8718, 21.7679];

/** Opening zoom — regional overview, no bounds fitting */
export const DEFAULT_MAP_ZOOM = 3;

/** Zoom used once we fly in to the resolved venue */
export const VENUE_LOAD_ZOOM = 18;

/** Pitch for the country-level opening view — flat reads better than tilted */
export const OVERVIEW_PITCH = 0;

/** Pitch used at venue level, where the 3D extrusions matter */
export const VENUE_PITCH = 60;

/**
 * Lower bound on zoom, applied only *after* the venue fly-in.
 *
 * It cannot be set upfront: raising minZoom clamps the current zoom
 * immediately, which would snap the country overview straight to street level.
 */
export const VENUE_MIN_ZOOM = 13;

/** Floor for the overview stage — low enough to frame the whole country */
export const OVERVIEW_MIN_ZOOM = 2;

/** Duration (ms) of the overview → venue fly-in */
export const VENUE_FLY_DURATION_MS = 2600;

export const getDefaultVenueCenter = () => ({
  lng: DEFAULT_MAP_CENTER[0],
  lat: DEFAULT_MAP_CENTER[1],
});
