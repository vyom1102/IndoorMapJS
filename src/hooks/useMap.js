import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "../constants/mapDefaults";

export const useMap = () => {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      pitch: 60,
      bearing: 0,
      maxZoom:24,
      minZoom: 13,
    });
    // map.addControl(new maplibregl.NavigationControl());
    map.on("load", ()=> setReady(true));
    mapRef.current = map;
  },[]);

  return {mapRef, containerRef, ready};
};
