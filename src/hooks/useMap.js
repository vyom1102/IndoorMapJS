
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

export const useMap = () => {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    if(mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [77.20451273263606,28.543355986530234],
      zoom:16,
      pitch:45
    });
    map.addControl(new maplibregl.NavigationControl());
    map.on("load", ()=> setReady(true));
    mapRef.current = map;
  },[]);

  return {mapRef, containerRef, ready};
};
