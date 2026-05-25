import { useEffect, useState, useRef } from "react";
import { useMap } from "./useMap";
import { getGeojsonData } from "../services/api";
import { loadVenueData } from "../services/venueApi";
import { splitFeatures } from "../utils/splitFeatures";
import { fetchNearbyNodes } from "../services/FetchGraphAPI";
import { dijkstra, findClosestNode } from "../utils/RouteFunctions";
import { getPoleOfInaccessibility, getPolygonCenter } from "../components/indoorMap/geometry";
import {
  removeRouteLayers,
  renderRouteForFloor as drawRouteForFloor,
} from "../utils/routeDisplay";

export function useIndoorMap() {
  const { mapRef, containerRef, ready } = useMap();

  const [geo, setGeo] = useState(null);
  const [floor, setFloor] = useState(0);
  const [venueData, setVenueData] = useState(null);
  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [sourceResults, setSourceResults] = useState([]);
  const [destResults, setDestResults] = useState([]);
  const [routeRevision, setRouteRevision] = useState(0);

  const markersRef = useRef([]);
  const sourceRef = useRef(null);
  const destRef = useRef(null);
  const customLayerIdsRef = useRef([]);
  const routePathRef = useRef([]);
  const graphRef = useRef(null);
  const sourceFloorRef = useRef(null);
  const destFloorRef = useRef(null);
  const floorRef = useRef(0);

  const venueName = "DelhiMetro";
  const defaultCenter = venueData
    ? [venueData.lng, venueData.lat]
    : [77.2437, 28.6063];

  // Load venue data on mount
  useEffect(() => {
    if (!venueName) return;
    const loadVenue = async () => {
      const data = await loadVenueData(venueName);
      if (!data) return;
      setVenueData(data);
      const map = mapRef.current;
      if (map) {
        map.flyTo({ center: [data.lng, data.lat], zoom: 18 });
      }
      setFloor(data.floors?.[0] || 0);
    };
    loadVenue();
  }, [venueName]);

  // Fetch GeoJSON data on mount
  useEffect(() => {
    getGeojsonData(venueName).then((res) => {
      if (!res?.data) return;
      setGeo({
        type: "FeatureCollection",
        features: res.data.data || res.data.features || [],
      });
    });
  }, []);

  // Floor cleanup function
  const cleanupFloor = (targetFloor) => {
    const map = mapRef.current;
    if (!map) return;

    // remove markers
    markersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch {}
    });
    markersRef.current = [];

    // remove custom 3d layers
    customLayerIdsRef.current.forEach((id) => {
      try {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      } catch {}
    });
    customLayerIdsRef.current = [];

    // remove all generated layers
    const styleLayers = map.getStyle()?.layers || [];
    styleLayers.forEach((layer) => {
      const id = layer.id;
      if (
        id.includes(`-${targetFloor}`) ||
        id.includes(`_${targetFloor}_`) ||
        id.startsWith("animal") ||
        id.startsWith("route-arrows") ||
        id.startsWith("route-traveled") ||
        id.startsWith("route-remaining") ||
        id.startsWith("route-point") ||
        id.startsWith("route-line") ||
        id === "route" ||
        id.startsWith("boundary") ||
        id.startsWith("section") ||
        id.startsWith("subsection") ||
        id.startsWith("sponsor") ||
        id.startsWith("exhibitor") ||
        id.startsWith("point-image") ||
        id.startsWith("default-poi")
      ) {
        try {
          if (map.getLayer(id)) {
            map.removeLayer(id);
          }
        } catch {}
      }
    });

    // remove sources
    const styleSources = map.getStyle()?.sources || {};
    Object.keys(styleSources).forEach((id) => {
      if (
        id.includes(`-${targetFloor}`) ||
        id.includes(`_${targetFloor}_`) ||
        id.startsWith("animal") ||
        id.startsWith("route-arrows") ||
        id.startsWith("route-traveled") ||
        id.startsWith("route-remaining") ||
        id.startsWith("route-point") ||
        id.startsWith("route-line") ||
        id === "route" ||
        id.startsWith("boundary") ||
        id.startsWith("section") ||
        id.startsWith("subsection") ||
        id.startsWith("sponsor") ||
        id.startsWith("exhibitor") ||
        id.startsWith("point-image") ||
        id.startsWith("default-poi")
      ) {
        try {
          if (map.getSource(id)) {
            map.removeSource(id);
          }
        } catch {}
      }
    });
  };

  useEffect(() => {
    floorRef.current = floor;
  }, [floor]);

  // Switch floor: remove previous floor layers immediately, then re-render new floor
  const switchFloor = async (newFloor) => {
    if (newFloor === floorRef.current) return;
    const previousFloor = floorRef.current;
    cleanupFloor(previousFloor);
    floorRef.current = newFloor;
    setFloor(newFloor);
  };

  const renderRouteForFloor = (pathCoords, targetFloor, options) => {
    const map = mapRef.current;
    if (!map) return;
    drawRouteForFloor(map, pathCoords, targetFloor, options);
  };

  const clearRoute = () => {
    const map = mapRef.current;
    routePathRef.current = [];
    graphRef.current = null;
    removeRouteLayers(map);
    setRouteRevision((revision) => revision + 1);
  };

  // Update marker visibility based on floor
  const updateMarkerVisibilityForFloor = (activeFloor) => {
    const map = mapRef.current;
    if (!map) return;

    if (sourceRef.current) {
      const showSource = sourceFloorRef.current === activeFloor;
      const el = sourceRef.current.getElement();
      if (el) {
        el.style.display = showSource ? "block" : "none";
      }
    }

    if (destRef.current) {
      const showDest = destFloorRef.current === activeFloor;
      const el = destRef.current.getElement();
      if (el) {
        el.style.display = showDest ? "block" : "none";
      }
    }
  };

  // Extract routing coordinates from feature
  const getFeatureRoutingCoordinates = (feature) => {
    if (!feature) return null;

    const geometryType = feature.geometry?.type;

    if (geometryType === "Point") {
      return feature.geometry?.coordinates;
    }

    return (
      feature.properties?.centroid ||
      getPoleOfInaccessibility(feature.geometry) ||
      getPolygonCenter(feature.geometry)
    );
  };

  // Calculate route using Dijkstra algorithm
  const handleRouting = async () => {
    if (!sourceRef.current || !destRef.current) return;

    const map = mapRef.current;
    const src = sourceRef.current.getLngLat();
    const dest = destRef.current.getLngLat();

    console.log("SRC:", src);
    console.log("DEST:", dest);

    const graph = await fetchNearbyNodes(src.lat, src.lng);
    console.log("GRAPH:", graph);

    if (!graph) return;

    const srcPoint = {
      lng: src.lng,
      lat: src.lat,
      floor: sourceFloorRef.current ?? floor,
    };

    const destPoint = {
      lng: dest.lng,
      lat: dest.lat,
      floor: destFloorRef.current ?? floor,
    };

    console.log("src:", srcPoint);
    console.log("dest:", destPoint);

    const selectedNodes = [];
    const unselectedNodes = [];
    const liftNodes = [];
    const stairsNodes = [];
    const escalatorNodes = [];
    const rampNodes = [];

    const start = findClosestNode(graph, srcPoint);
    const end = findClosestNode(graph, destPoint);

    console.log("START:", start);
    console.log("END:", end);

    if (!start || !end) {
      console.log("No valid start/end node");
      return;
    }

    const path = dijkstra(
      graph,
      start.key,
      end.key,
      "3d",
      selectedNodes,
      unselectedNodes,
      liftNodes,
      stairsNodes,
      escalatorNodes,
      rampNodes
    );

    console.log("PATH:", path);

    if (!path || !path.length) {
      console.log("No path found");
      return;
    }

    const coords = path.map((k) => {
      const [lng, lat, floorNo] = k.split(",");
      return {
        coord: [parseFloat(lng), parseFloat(lat)],
        floor: parseInt(floorNo),
      };
    });

    console.log("ROUTE COORDS:", coords);

    routePathRef.current = coords;
    graphRef.current = graph;
    setRouteRevision((revision) => revision + 1);

    const routeStartFloor = sourceFloorRef.current ?? floorRef.current;
    if (routeStartFloor !== floorRef.current) {
      cleanupFloor(floorRef.current);
      floorRef.current = routeStartFloor;
      setFloor(routeStartFloor);
    }
  };

  // Update marker visibility when floor changes
  useEffect(() => {
    updateMarkerVisibilityForFloor(floor);
  }, [floor]);

  return {
    mapRef,
    containerRef,
    ready,
    geo,
    setGeo,
    floor,
    setFloor,
    venueData,
    setVenueData,
    sourceQuery,
    setSourceQuery,
    destQuery,
    setDestQuery,
    sourceResults,
    setSourceResults,
    destResults,
    setDestResults,
    routeRevision,
    markersRef,
    sourceRef,
    destRef,
    customLayerIdsRef,
    routePathRef,
    graphRef,
    sourceFloorRef,
    destFloorRef,
    cleanupFloor,
    switchFloor,
    renderRouteForFloor,
    clearRoute,
    updateMarkerVisibilityForFloor,
    getFeatureRoutingCoordinates,
    handleRouting,
    venueName,
    defaultCenter,
  };
}
