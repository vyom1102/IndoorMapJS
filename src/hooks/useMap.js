import { useLayoutEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
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
      pitch: 60,
      bearing: 0,
      maxZoom: 24,
      minZoom: 3,
    });

    const handleLoad = () => {
      map.setMinZoom(13);
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
