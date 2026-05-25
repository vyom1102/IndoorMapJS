/** Default map center [lng, lat] before venue API loads */
export const DEFAULT_MAP_CENTER = [77.20451273263606, 28.543355986530234];

export const DEFAULT_MAP_ZOOM = 16;

export const VENUE_LOAD_ZOOM = 18;

export const getDefaultVenueCenter = () => ({
  lng: DEFAULT_MAP_CENTER[0],
  lat: DEFAULT_MAP_CENTER[1],
});
