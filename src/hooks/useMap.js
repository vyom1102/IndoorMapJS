import { useLayoutEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  OVERVIEW_MIN_ZOOM,
  OVERVIEW_PITCH,
} from "../constants/mapDefaults";

export const useMap = () => {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (mapRef.current || !container) return;

    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      // Flat for the country view; the venue fly-in pitches into 3D.
      pitch: OVERVIEW_PITCH,
      bearing: 0,
      maxZoom: 24,
      minZoom: OVERVIEW_MIN_ZOOM,
    });

    const handleLoad = () => {
      // NOTE: minZoom is deliberately left at OVERVIEW_MIN_ZOOM here. Raising
      // it clamps the current zoom on the spot, so setting the venue-level
      // floor now would yank the map out of the country overview before the
      // user ever sees it. useIndoorMap raises it once the fly-in lands.
      map.resize();
      requestAnimationFrame(() => map.resize());

      setReady(true);
    };

    map.on("load", handleLoad);
    mapRef.current = map;

    return () => {
      map.off("load", handleLoad);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [containerRef.current]);

  return { mapRef, containerRef, ready };
};
