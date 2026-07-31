/** Default map center [lng, lat] before venue API loads — geographic centre of India */
export const DEFAULT_MAP_CENTER = [78.8718, 21.7679];

/**
 * Opening view: the whole country.
 *
 * A fixed zoom can't do this correctly — how much of India fits on screen
 * depends on the viewport, so a value tuned on desktop crops the country on a
 * phone. fitBounds() against the national bounding box gets it right on any
 * screen; DEFAULT_MAP_ZOOM is only the constructor's pre-fit value.
 *
 * Bounds run from the Arabian Sea coast in the west to Arunachal in the east,
 * and Indira Point in the south to Kashmir in the north.
 */
export const INDIA_BOUNDS = [
  [68.0, 6.5],   // south-west [lng, lat]
  [97.5, 35.8],  // north-east [lng, lat]
];

/** Padding (px) around the country when fitting INDIA_BOUNDS */
export const INDIA_FIT_PADDING = 24;

export const DEFAULT_MAP_ZOOM = 4;

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
