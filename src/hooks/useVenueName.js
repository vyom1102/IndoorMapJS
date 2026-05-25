import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";

export const DEFAULT_VENUE_NAME = "DelhiMetro";

/**
 * Venue from URL — supports:
 * - Query: `?venue=MyVenue` or `?venueName=MyVenue`
 * - Path: `/MyVenue`
 */
export function useVenueName() {
  const { venueName: pathVenue } = useParams();
  const { search } = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(search);
    const queryVenue = params.get("venue") || params.get("venueName");
    const raw = (queryVenue || pathVenue || DEFAULT_VENUE_NAME).trim();
    return raw || DEFAULT_VENUE_NAME;
  }, [pathVenue, search]);
}
