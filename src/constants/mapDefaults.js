/** Default map center [lng, lat] before venue API loads */
export const DEFAULT_MAP_CENTER = [78.8718, 21.7679];
export const DEFAULT_MAP_ZOOM = 3;

export const VENUE_LOAD_ZOOM = 18;

export const getDefaultVenueCenter = () => ({
  lng: DEFAULT_MAP_CENTER[0],
  lat: DEFAULT_MAP_CENTER[1],
});
