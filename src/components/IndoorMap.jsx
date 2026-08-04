import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import * as THREE from "three";

import { useIndoorMap } from "../hooks/useIndoorMap";
import { useVenueName } from "../hooks/useVenueName";
import { splitFeatures } from "../utils/splitFeatures";
import { addPatternImage } from "../utils/patterns";
import {
  BOUNDARY_LOGO_SIZE_M,
  FIXED_GLB_SIZE_PX,
} from "./indoorMap/constants";
import {
  renderDefaultPoiLayer,
  renderAnimalMarkers,
  renderLandmarkGlbObjects,
} from "./indoorMap/LayerRenderer";
import {
  createTextTexture,
  initializeTextureCache,
  buildPlanesForPolygons,
  buildBoundaryLogoPlanes,
  buildSponsorLogoPlanes,
  buildExhibitorLogoPlanes,
  buildPointImagePlanes,
} from "./indoorMap/PlaneRenderer";
import {
  buildCarPlacements,
  buildEscalatorPlacements,
  buildLandmarkPrimitivePlacements,
  buildSittingAreaPlacements,
  buildTreePlacements,
} from "./indoorMap/ModelRenderer";
import {
  isEscalatorPolygonFeature,
  isSittingAreaPolygonFeature,
} from "./indoorMap/featureTypes";
import {
  getPoleOfInaccessibility,
  getPolygonCenter,
} from "./indoorMap/geometry";
import { getImageFileUrl } from "./indoorMap/assetUrls";
import {
  buildGltfModelLayer,
  buildLogoPlaneLayer,
  buildPrimitiveModelLayer,
} from "./indoorMap/customLayers";
import { searchPlaces, findPlaceById, getPlaceId } from "../utils/SearchEngine";

// Keep ?source=/?destination= in sync with what is selected, so the URL is always shareable.
const syncPlaceParam = (key, item) => {
  const url = new URL(window.location.href);
  const id = item ? getPlaceId(item.feature) : null;

  if (id) {
    url.searchParams.set(key, id);
  } else {
    url.searchParams.delete(key);
  }

  if (key === "destination") url.searchParams.delete("dest"); // alias, avoid two sources of truth

  window.history.replaceState({}, "", url);
};
import {
  selectSource,
  selectDest,
} from "../utils/SelectionHandlers";
import IndoorMapUI from "./IndoorMapUI";
import {
  followCameraBehindPointer,
  removeRouteLayers,
  updateNavigationRoute,
} from "../utils/routeDisplay";

const metersBetween = (a, b) => {
  if (!a || !b) return 0;
  const earthRadiusM = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const getRouteDistanceM = (points) =>
  points.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + metersBetween(points[index - 1]?.coord, point.coord);
  }, 0);

const formatDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatMinutes = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return "0 minutes";
  return `${Math.max(1, Math.round(meters / 80))} minutes`;
};

const getFloorLabel = (value) => {
  if (value < 0) return `B${Math.abs(value)}`;
  if (value === 0) return "G";
  return `F${value}`;
};

const toRad = (value) => (value * Math.PI) / 180;

const bearing = (from, to) => {
  if (!from || !to) return 0;
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const dLng = toRad(to[0] - from[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

const angleDiff = (fromDeg, toDeg) => {
  let delta = ((toDeg - fromDeg + 540) % 360) - 180;
  return delta;
};

const getManeuver = (delta, floorChange) => {
  if (floorChange) {
    return {
      icon: "⇅",
      instruction: `Continue to ${floorChange}`,
    };
  }
  if (Math.abs(delta) < 25) {
    return {
      icon: "↑",
      instruction: "Continue straight and follow the path.",
    };
  }
  if (delta <= -70) {
    return { icon: "↰", instruction: "Turn left and follow the path." };
  }
  if (delta < -25) {
    return {
      icon: "↖",
      instruction: "Make a slight left and follow the path.",
    };
  }
  if (delta >= 70) {
    return { icon: "↱", instruction: "Turn right and follow the path." };
  }
  return {
    icon: "↗",
    instruction: "Make a slight right and follow the path.",
  };
};

const buildRouteSteps = (points) => {
  if (!points.length) return [];
  if (points.length === 1) {
    return [
      {
        icon: "◎",
        instruction: "Arrive at destination",
        distance: "0 m",
        pointIndex: 0,
      },
    ];
  }

  const breakpoints = [0];

  for (let index = 2; index < points.length - 1; index += 1) {
    const floorChange = points[index].floor !== points[index - 1].floor;
    if (floorChange) {
      breakpoints.push(index);
      continue;
    }

    const prevBearing = bearing(
      points[index - 2].coord,
      points[index - 1].coord
    );
    const nextBearing = bearing(points[index - 1].coord, points[index].coord);
    const turnDelta = angleDiff(prevBearing, nextBearing);
    if (Math.abs(turnDelta) >= 35) {
      breakpoints.push(index);
    }
  }

  breakpoints.push(points.length - 1);

  const uniqueBreakpoints = breakpoints.filter(
    (value, index, array) => index === 0 || value !== array[index - 1]
  );

  const segments = uniqueBreakpoints.map((endIndex, stepIndex) => {
    const startIndex =
      stepIndex === 0 ? 0 : uniqueBreakpoints[stepIndex - 1];
    const segmentPoints = points.slice(startIndex, endIndex + 1);
    const distanceM = getRouteDistanceM(segmentPoints);
    const floorChange =
      stepIndex > 0 &&
      points[startIndex].floor !== points[endIndex].floor
        ? getFloorLabel(points[endIndex].floor)
        : null;

    let maneuver = { icon: "↑", instruction: "Continue straight and follow the path." };
    if (stepIndex === 0) {
      maneuver = { icon: "●", instruction: "Start on the route" };
    } else if (floorChange) {
      maneuver = getManeuver(0, floorChange);
    } else if (endIndex >= 2) {
      const prevBearing = bearing(
        points[endIndex - 2].coord,
        points[endIndex - 1].coord
      );
      const nextBearing = bearing(
        points[endIndex - 1].coord,
        points[endIndex].coord
      );
      maneuver = getManeuver(angleDiff(prevBearing, nextBearing), null);
    }

    return {
      icon: maneuver.icon,
      instruction: maneuver.instruction,
      distance: formatDistance(distanceM),
      // pointIndex: startIndex,
       pointIndex:
    stepIndex === 0
      ? 0
      : Math.max(
          0,
          endIndex - 1
        ),
    };
  });


const lastSegment =
  segments[segments.length - 1];

if (
  lastSegment &&
  points.length >= 2
) {
  lastSegment.icon = "↑";
  lastSegment.instruction =
    "Continue straight to destination";


const finalDistance =
  metersBetween(
    points[
      points.length - 2
    ]?.coord,
    points[
      points.length - 1
    ]?.coord
  );

// FORCE SMALL DISTANCE
lastSegment.distance =
  finalDistance <= 8
    ? "Few metres"
    : finalDistance <= 15
    ? "10 m"
    : formatDistance(finalDistance);
  lastSegment.pointIndex =
    Math.max(
      0,
      points.length - 2
    );

  segments.push({
    icon: "◎",
    instruction:
      "Arrive at destination",
    distance: "0 m",
    pointIndex:
      points.length - 1,
  });
}
  return segments;
};

const getStepInstruction = (steps, stepIndex) => {
  const step = steps[stepIndex];
  return step?.instruction || "Start navigation";
};

const isValidCoord = (coord) =>
  Array.isArray(coord) &&
  coord.length >= 2 &&
  Number.isFinite(coord[0]) &&
  Number.isFinite(coord[1]);

const getPointForStep = (points, steps, stepIndex) => {
  const step = steps[stepIndex];
  const point = points[step?.pointIndex ?? 0] ?? points[0];
  if (!point || !isValidCoord(point.coord)) return null;
  return point;
};

const createNavigationMarker = () => {
  const marker = document.createElement("div");
  marker.style.width = "28px";
  marker.style.height = "28px";
  marker.style.borderRadius = "50%";
  marker.style.background = "#2f57d6";
  marker.style.border = "4px solid #fff";
  marker.style.boxShadow = "0 10px 24px rgba(47,87,214,0.35)";
  marker.style.position = "relative";

  const pulse = document.createElement("div");
  pulse.style.position = "absolute";
  pulse.style.inset = "-10px";
  pulse.style.borderRadius = "50%";
  pulse.style.background = "rgba(47,87,214,0.18)";
  pulse.style.animation = "routePulse 1.4s ease-out infinite";
  marker.appendChild(pulse);

  return marker;
};

export default function IndoorMap() {
  const venueName = useVenueName();
  const renderGenerationRef = useRef(0);
  const navigationMarkerRef = useRef(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showStepsPreview, setShowStepsPreview] = useState(false);
  const [routeStepIndex, setRouteStepIndex] = useState(0);
  const [floorRenderReady, setFloorRenderReady] = useState(true);
  const [tappedFeature, setTappedFeature] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const navStateRef = useRef({
    isNavigating: false,
    showStepsPreview: false,
    routeStepIndex: 0,
    routeSteps: [],
  });

  const {
    mapRef,
    containerRef,
    ready,
    geo,
    setGeo,
    floor,
    setFloor,
    venueData,
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
    switchFloor,
    renderRouteForFloor,
    clearRoute,
    updateMarkerVisibilityForFloor,
    getFeatureRoutingCoordinates,
    handleRouting,
    venueCenter,
  } = useIndoorMap(venueName);

  const routePoints = routePathRef.current || [];
  const routeSteps = useMemo(
    () => buildRouteSteps(routePoints),
    [routeRevision]
  );
  const routeDistanceM = useMemo(
    () => getRouteDistanceM(routePoints),
    [routeRevision]
  );
  // const previewStepIndex = Math.min(
  //   routeStepIndex,
  //   Math.max(routeSteps.length - 1, 0)
  // );
  const previewStepIndex = Math.min(
  routeStepIndex,
  Math.max(
    routeSteps.length - 1,
    0
  )
);
  // const previewStepIndex =
  // showStepsPreview
  //   ? Math.max(
  //       0,
  //       routeStepIndex - 1
  //     )
  //   : routeStepIndex;
  const activePreviewStep = routeSteps[previewStepIndex];
  // const nextPreviewPoint = routePoints[activePreviewStep?.pointIndex + 1];
  const nextPreviewPoint =
  routePoints[
    Math.min(
      (activePreviewStep?.pointIndex || 0) + 1,
      routePoints.length - 1
    )
  ];
  const stepDistanceM = activePreviewStep
    ? metersBetween(
        routePoints[activePreviewStep.pointIndex]?.coord,
        nextPreviewPoint?.coord
      )
    : 0;
  navStateRef.current = {
    isNavigating,
    showStepsPreview,
    routeStepIndex,
    routeSteps,
  };
const [destSelected, setDestSelected] = useState(false);
  const [parking, setParking] = useState(null);
  const [markingParking, setMarkingParking] = useState(false);
  const parkingMarkerRef = useRef(null);

  useEffect(() => {
    // Restore parking from localStorage
    try {
      const raw = localStorage.getItem("my_parking");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.coord) && parsed.coord.length >= 2) {
          setParking(parsed);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Render parking marker when parking changes
    if (parking && parking.coord) {
      // remove old
      if (parkingMarkerRef.current) {
        parkingMarkerRef.current.remove();
        parkingMarkerRef.current = null;
      }
      const el = document.createElement("div");
      el.style.width = "36px";
      el.style.height = "36px";
      el.style.borderRadius = "12px";
      el.style.background = "rgba(47, 87, 214, 0.9)";
      el.style.color = "#fff";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.boxShadow = "0 8px 20px rgba(0,0,0,0.18)";
      el.style.width = "44px";
      el.style.height = "44px";
      el.style.fontSize = "22px";
      el.innerHTML = '🚗';
      parkingMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(parking.coord)
        .addTo(map);
    } else {
      if (parkingMarkerRef.current) {
        parkingMarkerRef.current.remove();
        parkingMarkerRef.current = null;
      }
    }
  }, [parking, ready]);

  const startMarkParking = () => {
    setMarkingParking(true);
  };

  const stopMarkParking = () => {
    setMarkingParking(false);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const onMapClickForParking = (e) => {
      if (!markingParking) return;
      // use lngLat if available
      const lngLat = e.lngLat || (e.lng && [e.lng, e.lat]);
      if (!lngLat) return;
      const coord = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
      if (!Number.isFinite(coord[0])) return;
      const saved = {
        coord,
        floor: floor,
        floorLabel: getFloorLabel(floor),
        ts: Date.now(),
      };
      try {
        localStorage.setItem("my_parking", JSON.stringify(saved));
      } catch (err) {
        // ignore
      }
      setParking(saved);
      setMarkingParking(false);
      // zoom to marker
      try {
        map.flyTo({ center: coord, zoom: 20 });
      } catch (e) {}
    };

    map.on("click", onMapClickForParking);
    return () => map.off("click", onMapClickForParking);
  }, [markingParking, ready, floor]);

  const routeSummary = {
    hasRoute: routePoints.length > 1,
    distance: formatDistance(routeDistanceM),
    duration: formatMinutes(routeDistanceM),
    // stepDistance: formatDistance(stepDistanceM || routeDistanceM),
    stepDistance:
  routeSteps[
    Math.min(
      routeStepIndex + 1,
      routeSteps.length - 1
    )
  ]?.distance ||
  formatDistance(routeDistanceM),
    // instruction: getStepInstruction(routeSteps, previewStepIndex),
    instruction:
  routeSteps[
    Math.min(
      routeStepIndex + 1,
      routeSteps.length - 1
    )
  ]?.instruction ||
  "Start navigation",
    destinationName: destQuery || "Destination",
    destinationArea: getFloorLabel(destFloorRef.current ?? floor),
    routeSteps,
    showStepsPreview,
    // currentStep: routeSteps.length ? previewStepIndex  : 0,
    currentStep:
  routeSteps.length
    ? routeStepIndex
    : 0,
    totalSteps: routeSteps.length -1 ,
    isNavigating,
    canGoBack: previewStepIndex > 0,
    // canGoNext: previewStepIndex < routeSteps.length - 2,
    canGoNext:
  previewStepIndex <
  routeSteps.length - 2,
  };

  const handleFloorSwitch = (newFloor) => {
    if (newFloor === floor) return;
    const map = mapRef.current;
    setFloorRenderReady(false);
    removeRouteLayers(map);
    switchFloor(newFloor);
  };

  const moveToRouteStep = (nextIndex) => {
    if (!routeSteps.length) return;
    // const boundedIndex = Math.max(0, Math.min(nextIndex, routeSteps.length - 1));
  //   const maxNavigationIndex =
  // Math.max(
  //   0,
  //   routeSteps.length - 2
  // );
const maxNavigationIndex =
  Math.max(
    0,
    routeSteps.length - 1
  );
const boundedIndex =
  Math.max(
    0,
    Math.min(
      nextIndex,
      maxNavigationIndex
    )
  );
    setRouteStepIndex(boundedIndex);
  };

  const openStepsPreview = () => {
    if (!routeSteps.length) return;
    if (navigationMarkerRef.current) {
      navigationMarkerRef.current.remove();
      navigationMarkerRef.current = null;
    }
    setIsNavigating(false);
    // setRouteStepIndex(0);
    setRouteStepIndex(
      routeSteps.length > 1
        ? 1
        : 0
    );
    setShowStepsPreview(true);
  };

  const closeStepsPreview = () => {
    setShowStepsPreview(false);
  };

  // const startNavigation = () => {
  //   if (!routeSteps.length) return;
  //   setShowStepsPreview(false);
  //   setIsNavigating(true);
  //   setRouteStepIndex(0);
  // };
const startNavigation = () => {
  if (!routeSteps.length) return;

  setShowStepsPreview(false);
  setIsNavigating(true);

  // SKIP START STEP
  // const firstRealStep =
  //   routeSteps.length > 2
  //     ? 1
  //     : 0;
const firstRealStep = 0;
  setRouteStepIndex(
    firstRealStep
  );

  // AUTO SWITCH FLOOR TO STEP
  const step =
    routeSteps[firstRealStep];

  const point =
    routePoints[
      step?.pointIndex || 0
    ];

  if (
    point &&
    point.floor !== floor
  ) {
    handleFloorSwitch(
      point.floor
    );
  }

  if (
    point &&
    point.floor === floor
  ) {
    setFloorRenderReady(true);
  }
};
  const endNavigation = () => {
    setIsNavigating(false);
    setShowStepsPreview(false);
    setRouteStepIndex(0);
    if (navigationMarkerRef.current) {
      navigationMarkerRef.current.remove();
      navigationMarkerRef.current = null;
    }
  };

  const clearDirections = () => {
    setDestSelected(false); 
    endNavigation();
    setShowStepsPreview(false);
    clearRoute();
    sourceRef.current?.remove();
    destRef.current?.remove();
    sourceRef.current = null;
    destRef.current = null;
    sourceFloorRef.current = null;
    destFloorRef.current = null;
    setSourceQuery("");
    setDestQuery("");
    setSourceResults([]);
    setDestResults([]);
    syncPlaceParam("source", null);
    syncPlaceParam("destination", null);
  };

  useEffect(() => {
    if (!routePoints.length) {
      endNavigation();
      return;
    }
    setRouteStepIndex((index) =>
      Math.min(index, Math.max(routeSteps.length - 1, 0))
    );
  }, [routeRevision, routeSteps.length]);

  // Align floor with the active navigation/step point before drawing route
  useEffect(() => {
    if (!showStepsPreview && !isNavigating) return;

    const pathPoints = routePathRef.current || [];
    const point = getPointForStep(pathPoints, routeSteps, routeStepIndex);
    if (!point) return;

    if (point.floor !== floor) {
      handleFloorSwitch(point.floor);
    }
  }, [
    showStepsPreview,
    isNavigating,
    routeStepIndex,
    floor,
    routeSteps,
    routeRevision,
  ]);

  // Draw route, marker, and camera once floor matches the active step
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (!isNavigating && !showStepsPreview) || !floorRenderReady) return;

    const pathPoints = routePathRef.current || [];
    const activeGlobalIndex = routeSteps[routeStepIndex]?.pointIndex ?? 0;
    const point = getPointForStep(pathPoints, routeSteps, routeStepIndex);
    if (!point || point.floor !== floor) return;

    const routeDrawn = updateNavigationRoute(
      map,
      pathPoints,
      floor,
      activeGlobalIndex
    );
    if (!routeDrawn) {
      renderRouteForFloor(pathPoints, floor, {
        navigationMode: false,
      });
    }

    if (isNavigating) {
      if (!navigationMarkerRef.current) {
        navigationMarkerRef.current = new maplibregl.Marker({
          element: createNavigationMarker(),
          anchor: "center",
        })
          .setLngLat(point.coord)
          .addTo(map);
      } else {
        navigationMarkerRef.current.setLngLat(point.coord);
      }
    } else if (navigationMarkerRef.current) {
      navigationMarkerRef.current.remove();
      navigationMarkerRef.current = null;
    }

    const segmentEndIndex =
      routeSteps[routeStepIndex + 1]?.pointIndex ?? pathPoints.length - 1;
    followCameraBehindPointer(
      map,
      pathPoints,
      activeGlobalIndex,
      floor,
      segmentEndIndex
    );
  }, [
    floor,
    floorRenderReady,
    isNavigating,
    showStepsPreview,
    routeRevision,
    routeStepIndex,
    routeSteps,
  ]);

  // Restore planned route view when leaving steps/navigation preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map || showStepsPreview || isNavigating || !floorRenderReady) return;
    const pathPoints = routePathRef.current || [];
    if (!pathPoints.length) return;

    renderRouteForFloor(pathPoints, floor, { navigationMode: false });
  }, [
    showStepsPreview,
    isNavigating,
    floor,
    floorRenderReady,
    routeRevision,
  ]);

  useEffect(() => {
  const map = mapRef.current;
  if (!map || !geo || !ready) return;

  const renderGeneration = renderGenerationRef.current + 1;
  renderGenerationRef.current = renderGeneration;
  let cancelled = false;
  const zoomHandlers = [];
  const isCurrentRender = () =>
    !cancelled && renderGenerationRef.current === renderGeneration;

  setFloorRenderReady(false);

  const FLOOR_HEIGHT = 3; // vertical metres per floor level

  const render = async () => {
    if (!isCurrentRender()) return;

    const renderCurrentRoute = () => {
      if (!isCurrentRender() || !routePathRef.current?.length) return;
      const navState = navStateRef.current;
      const inPreview = navState.isNavigating || navState.showStepsPreview;
      renderRouteForFloor(routePathRef.current, floor, {
        navigationMode: inPreview,
        activeGlobalIndex:
          navState.routeSteps[navState.routeStepIndex]?.pointIndex ?? 0,
      });
    };

    removeRouteLayers(map);

    // Remove all custom 3D layers
    const allFloors = venueData?.floors || [floor];
    const customLayerPrefixes = [
      "boundary-logo-3d-",
      "sponsor-logo-3d-",
      "exhibitor-logo-3d-",
      "point-image-3d-",
      "escalator-model-3d-",
      "sitting-area-model-3d-",
      "tree-model-3d-",
      "car-model-3d-",
      "landmark-model-3d-",
    ];
    allFloors.forEach((f) => {
      customLayerPrefixes.forEach((prefix) => {
        const id = `${prefix}${f}`;
        if (map.getLayer(id)) map.removeLayer(id);
      });
    });
    customLayerIdsRef.current.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    customLayerIdsRef.current = [];

    const addTrackedLogoLayer = (layerId, planes) => {
      buildLogoPlaneLayer(map, layerId, planes);
      customLayerIdsRef.current.push(layerId);
    };

    const addTrackedGltfLayer = (layerId, modelUrl, placements) => {
      buildGltfModelLayer(map, layerId, modelUrl, placements);
      customLayerIdsRef.current.push(layerId);
    };

    // ── Remove old layers/sources for ALL previously rendered floors ──────────
    const layers = map.getStyle()?.layers || [];
    layers.forEach((l) => {
      if (
        l.id.startsWith("floor_") ||
        l.id.startsWith("animal") ||
        l.id.startsWith("sponsor") ||
        l.id.startsWith("exhibitor") ||
        l.id.startsWith("point-image") ||
        l.id.startsWith("boundary-") ||
        l.id.startsWith("section-") ||
        l.id.startsWith("subsection-") ||
        l.id.startsWith("pattern_") ||
        l.id.startsWith("default-poi")
      ) {
        try {
          if (map.getLayer(l.id)) map.removeLayer(l.id);
        } catch (e) {
          console.warn(`Failed to remove layer ${l.id}`, e);
        }
      }
    });
    const sources = map.getStyle()?.sources || {};
    Object.keys(sources).forEach((id) => {
      if (
        id.startsWith("floor_") ||
        id === "animal-source" ||
        id.startsWith("sponsor") ||
        id.startsWith("exhibitor") ||
        id.startsWith("boundary-") ||
        id.startsWith("section-") ||
        id.startsWith("subsection-") ||
        id.startsWith("pattern_") ||
        id.startsWith("default-poi")
      ) {
        if (!map.getSource(id)) return;
        // Detach any layers still using this source (e.g. left behind by an
        // aborted/stale render pass) so removeSource cannot throw.
        (map.getStyle()?.layers || []).forEach((l) => {
          if (l.source === id) {
            try {
              if (map.getLayer(l.id)) map.removeLayer(l.id);
            } catch (e) {
              console.warn(`Failed to remove layer ${l.id}`, e);
            }
          }
        });
        try {
          map.removeSource(id);
        } catch (e) {
          console.warn(`Failed to remove source ${id}`, e);
        }
      }
    });

    // ── Render every floor from 0 up to (and including) the active floor ──────
    // const floorsToRender = Array.from({ length: floor + 1 }, (_, i) => i);
    const availableFloors = [...(venueData?.floors || [floor])].sort(
  (a, b) => a - b
);

const floorsToRender =
  floor <= 0
    ? [floor]                    // basement floors: render only current floor
    : availableFloors.filter((f) => f <= floor); // normal floors: stack below

    const isSingleFloorRender = floorsToRender.length === 1;
  const boundaryFloor =
  floor < 0
    ? floor // for basement view show its own boundary
    : availableFloors.includes(0)
      ? 0
      : Math.min(...availableFloors);
    for (const floorIndex of floorsToRender) {
      if (!isCurrentRender()) return;

      // Base height offset for this floor level (metres)
      // const baseOffset = floorIndex * FLOOR_HEIGHT;
const baseOffset =
  floorIndex < 0
    ? 0
    : floorIndex * FLOOR_HEIGHT;
      const floorFeatures = geo.features.filter(
        (f) => (f.properties?.floor ?? 0) === floorIndex
      );

      const {
        rooms,
        boundaries,
        animals,
        sections,
        sponsorPoints,
        exhibitorPoints,
      } = splitFeatures(floorFeatures);

      const renderableRooms = rooms.filter(
        (feature) =>
          !isEscalatorPolygonFeature(feature) &&
          !isSittingAreaPolygonFeature(feature)
      );

      const topSections = sections.filter(
        (f) => !f.properties?.subSection && f.properties?.type !== "Sub Section"
      );
      const subSections = sections.filter(
        (f) =>
          f.properties?.subSection || f.properties?.type === "Sub Section"
      );

      const imagedPoints = floorFeatures.filter((f) => {
        const p = f.properties || {};
        return (
          f.geometry?.type === "Point" &&
          !p.sponsorRef &&
          !p.exhibitorRef &&
          !p.animalRef &&
          f.properties?.type !== "Section"
        );
      });

    
    if (floorIndex === boundaryFloor) {
      map.addSource(`boundary-base-src-${floorIndex}`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: boundaries },
      });

      map.addLayer({
        id: `boundary-base-${floorIndex}`,
        type: "fill",
        source: `boundary-base-src-${floorIndex}`,
        paint: {
          "fill-color": "#D4DBDD",
          "fill-opacity": 1,
        },
      });
    }
      // ── Helper: build height expression offset by baseOffset ────────────────
      // Takes the raw per-feature height expression and adds baseOffset to both
      // fill-extrusion-base and fill-extrusion-height so the floor is stacked.
      const extrusionBase = [
        "+",
        baseOffset,
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
      ];

      const extrusionHeight = [
        "case",
        ["==", ["downcase", ["get", "type"]], "wall"],
        [
          "+",
          baseOffset,
          ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
          [
            "case",
            ["all", ["has", "height"], ["!=", ["get", "height"], "undefined"], [">", ["to-number", ["get", "height"]], 0]],
            ["to-number", ["get", "height"]],
            3,
          ],
        ],
        ["==", ["get", "type"], "Booth"],
        ["+", baseOffset, ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 2],
        [
          "any",
          ["==", ["downcase", ["get", "type"]], "lift"],
          ["in", ["downcase", ["get", "type"]], ["literal", [
             "piller", "counter", "security check",
            "male washroom", "female washroom", "unisex washroom",
            "drinking water", "accessible washroom",
          ]]],
        ],
        [
          "+",
          baseOffset,
          ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
          [
            "case",
            ["all", ["has", "height"], ["!=", ["get", "height"], "undefined"], [">", ["to-number", ["get", "height"]], 0]],
            ["to-number", ["get", "height"]],
            2,
          ],
        ],
        ["in", ["downcase", ["get", "type"]], ["literal", ["green area", "green area | pots"]]],
        ["+", baseOffset, ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 0.2],
        ["all", ["has", "height"], ["!=", ["get", "height"], "undefined"], [">", ["to-number", ["get", "height"]], 0]],
        [
          "+",
          baseOffset,
          ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
          ["to-number", ["get", "height"]],
        ],
        ["+", baseOffset, ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0]],
      ];

      // ── 2. ROOMS (3D) ───────────────────────────────────────────────────────
      map.addSource(`floor_${floorIndex}_rooms`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: renderableRooms },
      });
      map.addLayer({
        id: `floor_${floorIndex}_rooms`,
        type: "fill-extrusion",
        source: `floor_${floorIndex}_rooms`,
        minzoom: 14,
        paint: {
          "fill-extrusion-color": [
            "case",
            ["all", ["has", "fillColor"], ["!=", ["get", "fillColor"], "undefined"]],
            ["get", "fillColor"],
            ["==", ["get", "type"], "Accessible Washroom"], "#8EDB88",
            ["==", ["get", "type"], "Female Washroom"], "#8EDB88",
            ["==", ["get", "type"], "Male Washroom"], "#8EDB88",
            ["==", ["get", "type"], "Unisex Washroom"], "#8EDB88",
            ["==", ["get", "type"], "Drinking Water"], "#0277BD",
            ["==", ["get", "type"], "Food Lounge"], "#D84315",
            ["==", ["get", "type"], "Lift"], "#013975",
            ["==", ["get", "type"], "Stairs"], "#546E7A",
            ["==", ["get", "type"], "Steps"], "#B9BBBD",
            ["in", ["get", "type"], ["literal", ["Lab", "room", "Room", "Rooms"]]], "#FFC35D",
            ["==", ["get", "type"], "Office"], "#A38F9F",
            ["==", ["get", "type"], "Reception"], "#1976D2",
            ["==", ["get", "type"], "Booth"], "#8AE8F9",
            ["==", ["get", "type"], "Registration Counter"], "#7B1FA2",
            ["==", ["get", "type"], "Point of Interest"], "#C2185B",
            ["==", ["get", "type"], "Restricted Area"], "#BC9F7E",
            ["==", ["get", "type"], "Non Walkable"], "#424242",
            ["in", ["downcase", ["get", "type"]], ["literal", ["green area", "green area | pots"]]], "#ADFA9E",
            ["==", ["get", "type"], "Wall"], "#DCDCDC",
            ["==", ["get", "type"], "Piller"], "#5D4037",
            ["==", ["get", "type"], "Terrace"], "#00695C",
            "#B9BBBD",
          ],
          "fill-extrusion-height": extrusionHeight,
          "fill-extrusion-base": extrusionBase,
          "fill-extrusion-opacity": floorIndex === floor ? 1 : 0.55, // dim lower floors slightly
        },
      });

      // ── Highlight layer ─────────────────────────────────────────────────────
      map.addSource(`floor_${floorIndex}_highlight`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: `floor_${floorIndex}_highlight`,
        type: "fill-extrusion",
        source: `floor_${floorIndex}_highlight`,
        minzoom: 16,
        paint: {
          "fill-extrusion-color": "#4a4a4a",
          "fill-extrusion-height": extrusionHeight,
          "fill-extrusion-base": extrusionBase,
          "fill-extrusion-opacity": 0.7,
        },
      });

      // ── ESCALATORS / SITTING AREAS / TREES ─────────────────────────────────
      const escalatorPlacementsByModel = buildEscalatorPlacements(floorFeatures);
      Array.from(escalatorPlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {
        addTrackedGltfLayer(`escalator-model-3d-${floorIndex}-${index}`, modelUrl, placements);
      });
      const sittingAreaPlacementsByModel = buildSittingAreaPlacements(floorFeatures);
      Array.from(sittingAreaPlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {
        addTrackedGltfLayer(`sitting-area-model-3d-${floorIndex}-${index}`, modelUrl, placements);
      });
      const treePlacementsByModel = buildTreePlacements(floorFeatures);
      Array.from(treePlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {
        addTrackedGltfLayer(`tree-model-3d-${floorIndex}-${index}`, modelUrl, placements);
      });

      const carPlacementsByModel = buildCarPlacements(floorFeatures);          // ADDED
      Array.from(carPlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {  // ADDED
        addTrackedGltfLayer(`car-model-3d-${floorIndex}-${index}`, modelUrl, placements);        // ADDED
      });

      // ── LANDMARK 3D PRIMITIVES (inline 3dRef models on point features) ─────
      const landmarkPlacements = buildLandmarkPrimitivePlacements(floorFeatures);
      if (landmarkPlacements.length) {
        const landmarkLayerId = `landmark-model-3d-${floorIndex}`;
        buildPrimitiveModelLayer(map, landmarkLayerId, landmarkPlacements);
        customLayerIdsRef.current.push(landmarkLayerId);
      }
      // ── 3. SECTIONS (3D) ────────────────────────────────────────────────────
      map.addSource(`section-src-${floorIndex}`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: topSections },
      });
      map.addLayer({
        id: `floor_${floorIndex}_sections`,
        type: "fill-extrusion",
        source: `section-src-${floorIndex}`,
        minzoom: 16,
        maxzoom: 17,
        paint: {
          "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#ccc"],
          "fill-extrusion-height": [
            "case",
            ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
            ["+", baseOffset, ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
            ["+", baseOffset, ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 4],
          ],
          "fill-extrusion-base": extrusionBase,
          "fill-extrusion-opacity": floorIndex === floor ? 1 : 0.55,
        },
      });

      // ── 4. SUBSECTIONS (3D) ─────────────────────────────────────────────────
      map.addSource(`subsection-src-${floorIndex}`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: subSections },
      });
      map.addLayer({
        id: `floor_${floorIndex}_subsections`,
        type: "fill-extrusion",
        source: `subsection-src-${floorIndex}`,
        minzoom: 17,
        maxzoom: 18,
        paint: {
          "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#aaa"],
          "fill-extrusion-height": [
            "case",
            ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
            ["+", baseOffset, ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
            ["+", baseOffset, ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 4],
          ],
          "fill-extrusion-base": extrusionBase,
          "fill-extrusion-opacity": floorIndex === floor ? 1 : 0.55,
        },
      });

      // ── PATTERNS ────────────────────────────────────────────────────────────
      rooms.forEach((f, i) => {
        if (!f.properties?.pattern) return;
        const pat = addPatternImage(map, f.properties);
        const src = `pattern_${floorIndex}_${i}`;
        if (map.getLayer(src)) map.removeLayer(src);
        if (map.getSource(src)) map.removeSource(src);
        map.addSource(src, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [f] },
        });
        map.addLayer({ id: src, type: "fill", source: src, paint: { "fill-pattern": pat } });
      });

      // ── 5. BOUNDARY LABELS (only for the active floor) ──────────────────────
      if (floorIndex === floor) {
        const boundaryLabelFeatures = boundaries
          .filter((f) => f.properties?.name)
          .map((f) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: getPoleOfInaccessibility(f.geometry) || getPolygonCenter(f.geometry),
            },
            properties: { name: f.properties.name },
          }))
          .filter((f) => f.geometry.coordinates);

        map.addSource(`boundary-label-src-${floorIndex}`, {
          type: "geojson",
          data: { type: "FeatureCollection", features: boundaryLabelFeatures },
        });
        map.addLayer({
          id: `boundary-label-${floorIndex}`,
          type: "symbol",
          source: `boundary-label-src-${floorIndex}`,
          minzoom: 15,
          maxzoom: 16,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 14,
            "text-anchor": "center",
            "text-offset": [0, 1.5],
            "text-allow-overlap": false,
          },
          paint: { "text-color": "#222", "text-halo-color": "#fff", "text-halo-width": 1.5 },
        });
      }

      // ── 6. SECTION LABELS + LOGOS (only for the active floor) ───────────────
      if (floorIndex === floor) {
        const sectionImageByPolygon = new Map();
        const sectionCentroidByPolygon = new Map();

        for (const f of floorFeatures) {
          const p = f.properties || {};
          if (f.geometry?.type !== "Point") continue;
          if (!Array.isArray(p.associatedPolygons)) continue;
          const isSection = p.type === "Section" && !p.subSection && p.polygonType !== "Sub Section";
          const centroid = p.centroid || (f.geometry?.type === "Point" ? f.geometry.coordinates : null);
          for (const polyId of p.associatedPolygons) {
            const key = String(polyId);
            if (isSection) {
              if (p.imageFile) sectionImageByPolygon.set(key, p.imageFile);
              if (centroid) sectionCentroidByPolygon.set(key, centroid);
            } else {
              if (p.imageFile && !sectionImageByPolygon.has(key)) sectionImageByPolygon.set(key, p.imageFile);
              if (centroid && !sectionCentroidByPolygon.has(key)) sectionCentroidByPolygon.set(key, centroid);
            }
          }
        }

        const sectionSymbolFeatures = [];
        for (const section of topSections) {
          const p = section.properties || {};
          const sectionId = String(section.id || section._id || p.id || p._id || "");
          const centroidCoords = sectionCentroidByPolygon.get(sectionId) || p.centroid || null;
          const center =
            (Array.isArray(centroidCoords) ? centroidCoords : null) ||
            getPoleOfInaccessibility(section.geometry) ||
            getPolygonCenter(section.geometry);
          if (!center || !p.name) continue;

          const rawImageFile = p.imageFile || p.logo || p.logoUrl || sectionImageByPolygon.get(sectionId) || "";
          const logoUrl = getImageFileUrl(rawImageFile);
          let iconId = null;
          if (logoUrl) {
            iconId = `section-icon-${logoUrl.split("/").pop().split("?")[0]}`;
            if (!map.hasImage(iconId)) {
              await new Promise((resolve) => {
                map.loadImage(logoUrl, (err, image) => {
                  if (!err && image && !map.hasImage(iconId)) map.addImage(iconId, image);
                  resolve();
                });
              });
              if (!isCurrentRender()) return;
            }
          }
          if (!isCurrentRender()) return;
          sectionSymbolFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: center },
            properties: { name: p.name, icon: iconId || "" },
          });
        }

        if (sectionSymbolFeatures.length) {
          map.addSource(`section-label-src-${floorIndex}`, {
            type: "geojson",
            data: { type: "FeatureCollection", features: sectionSymbolFeatures },
          });
          map.addLayer({
            id: `section-label-${floorIndex}`,
            type: "symbol",
            source: `section-label-src-${floorIndex}`,
            minzoom: 16,
            maxzoom: 17,
            layout: {
              "icon-image": ["case", ["!=", ["get", "icon"], ""], ["get", "icon"], ""],
              "icon-size": 0.15,
              "icon-anchor": "center",
              "icon-text-fit": "none",
              "text-field": ["get", "name"],
              "text-size": 12,
              "text-anchor": "left",
              "text-offset": [1.2, 0],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "symbol-placement": "point",
            },
            paint: { "text-color": "#333", "text-halo-color": "#fff", "text-halo-width": 1.5 },
          });
        }

        // ── ANIMALS + LANDMARKS + POI (active floor only) ──────────────────
        if (animals.length) {
          await renderAnimalMarkers(map, animals, markersRef, FIXED_GLB_SIZE_PX);
          if (!isCurrentRender()) return;
        }
        renderLandmarkGlbObjects(map, floorFeatures, markersRef, FIXED_GLB_SIZE_PX);
        await renderDefaultPoiLayer(map, floorFeatures, floorIndex, isCurrentRender);
        if (!isCurrentRender()) return;
      }

      // ── TEXTURE + PLANE RENDERING (active floor only) ──────────────────────
      if (floorIndex === floor) {
        const { textureCache, loadTexture } = initializeTextureCache();
        const polygonLookup = new Map();
        [...boundaries, ...rooms, ...topSections, ...subSections].forEach((feature) => {
          const keys = [feature.id, feature._id, feature.properties?.id, feature.properties?._id].filter(Boolean);
          keys.forEach((key) => polygonLookup.set(String(key), feature));
        });

        const boundaryLogoPlanes = await buildBoundaryLogoPlanes(boundaries, loadTexture, BOUNDARY_LOGO_SIZE_M,baseOffset);
        if (!isCurrentRender()) return;
        if (boundaryLogoPlanes.length) {
          const boundaryLogoLayerId = `boundary-logo-3d-${floorIndex}`;
          addTrackedLogoLayer(boundaryLogoLayerId, boundaryLogoPlanes);
          const updateBoundaryLogoVisibility = () => {
            const z = map.getZoom();
            const visible = z >= 15 && z < 16;
            if (map.getLayer(boundaryLogoLayerId)) {
              map.setLayoutProperty(boundaryLogoLayerId, "visibility", visible ? "visible" : "none");
            }
          };
          updateBoundaryLogoVisibility();
          map.on("zoom", updateBoundaryLogoVisibility);
          zoomHandlers.push(updateBoundaryLogoVisibility);
        }

        const { logoPlanes: sponsorLogoPlanes } = await buildSponsorLogoPlanes(sponsorPoints, loadTexture, polygonLookup, buildPlanesForPolygons,baseOffset);
        if (!isCurrentRender()) return;
        if (sponsorLogoPlanes.length) addTrackedLogoLayer(`sponsor-logo-3d-${floorIndex}`, sponsorLogoPlanes);

        const exhibitorLogoPlanes = await buildExhibitorLogoPlanes(exhibitorPoints, loadTexture, polygonLookup, buildPlanesForPolygons,baseOffset);
        if (!isCurrentRender()) return;
        if (exhibitorLogoPlanes.length) addTrackedLogoLayer(`exhibitor-logo-3d-${floorIndex}`, exhibitorLogoPlanes);

        const pointImagePlanes = await buildPointImagePlanes(imagedPoints, loadTexture, polygonLookup,baseOffset);
        if (!isCurrentRender()) return;
        if (pointImagePlanes.length) addTrackedLogoLayer(`point-image-3d-${floorIndex}`, pointImagePlanes);
      }
    } // end floorsToRender loop

    if (!isCurrentRender()) return;

    // Clear markers from previous render before rebuilding for active floor
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    setFloorRenderReady(true);
    renderCurrentRoute();
    updateMarkerVisibilityForFloor(floor);

    const navState = navStateRef.current;
    if (
      (navState.isNavigating || navState.showStepsPreview) &&
      routePathRef.current?.length
    ) {
      const pathPoints = routePathRef.current;
      const point = getPointForStep(pathPoints, navState.routeSteps, navState.routeStepIndex);
      if (point?.floor === floor) {
        const activeGlobalIndex = navState.routeSteps[navState.routeStepIndex]?.pointIndex ?? 0;
        updateNavigationRoute(map, pathPoints, floor, activeGlobalIndex);
      }
    }
  };

  // Gate on the style *existing*, not on isStyleLoaded().
  //
  // MapLibre's isStyleLoaded() is false while ANY source cache still has tiles
  // in flight — so on a large venue it stays false long after the map is
  // perfectly usable. The old fallback here was `map.once("load", render)`, but
  // "load" fires exactly once and has already fired by the time `ready` is
  // true, so that listener never ran: the floor silently never rendered until
  // some other dependency change (switching floors) re-ran this effect and
  // happened to catch the map between tile loads.
  //
  // What render() actually needs is the style object to exist so layers and
  // sources can be added; pending tiles are irrelevant.
  const hasStyle = () => {
    try {
      return Boolean(map.getStyle()?.layers);
    } catch {
      return false;
    }
  };

  let onStyleData = null;

  if (hasStyle()) {
    render();
  } else {
    onStyleData = () => {
      if (!isCurrentRender()) return;
      if (!hasStyle()) return;
      map.off("styledata", onStyleData);
      onStyleData = null;
      render();
    };
    // styledata fires repeatedly as the style is built up, so unlike "load"
    // this cannot be missed by arriving late.
    map.on("styledata", onStyleData);
  }

  return () => {
    cancelled = true;
    if (onStyleData) map.off("styledata", onStyleData);
    zoomHandlers.forEach((handler) => map.off("zoom", handler));
  };
}, [geo, floor, ready, routeRevision]);
  // Main rendering effect
  // useEffect(() => {
  //   const map = mapRef.current;
  //   if (!map || !geo || !ready) return;

  //   const renderGeneration = renderGenerationRef.current + 1;
  //   renderGenerationRef.current = renderGeneration;
  //   let cancelled = false;
  //   const zoomHandlers = [];
  //   const isCurrentRender = () =>
  //     !cancelled && renderGenerationRef.current === renderGeneration;

  //   setFloorRenderReady(false);

  //   const render = async () => {
  //     if (!isCurrentRender()) return;

  //     const renderCurrentRoute = () => {
  //       if (!isCurrentRender() || !routePathRef.current?.length) return;
  //       const navState = navStateRef.current;
  //       const inPreview = navState.isNavigating || navState.showStepsPreview;
  //       renderRouteForFloor(routePathRef.current, floor, {
  //         navigationMode: inPreview,
  //         activeGlobalIndex:
  //           navState.routeSteps[navState.routeStepIndex]?.pointIndex ?? 0,
  //       });
  //     };

  //     removeRouteLayers(map);

  //     // Remove all custom 3D layers
  //     const allFloors = venueData?.floors || [floor];
  //     const customLayerPrefixes = [
  //       "boundary-logo-3d-",
  //       "sponsor-logo-3d-",
  //       "exhibitor-logo-3d-",
  //       "point-image-3d-",
  //       "escalator-model-3d-",
  //       "sitting-area-model-3d-",
  //       "tree-model-3d-",
  //     ];
  //     allFloors.forEach((f) => {
  //       customLayerPrefixes.forEach((prefix) => {
  //         const id = `${prefix}${f}`;
  //         if (map.getLayer(id)) map.removeLayer(id);
  //       });
  //     });
  //     customLayerIdsRef.current.forEach((id) => {
  //       if (map.getLayer(id)) map.removeLayer(id);
  //     });
  //     customLayerIdsRef.current = [];

  //     const addTrackedLogoLayer = (layerId, planes) => {
  //       buildLogoPlaneLayer(map, layerId, planes);
  //       customLayerIdsRef.current.push(layerId);
  //     };

  //     const addTrackedGltfLayer = (layerId, modelUrl, placements) => {
  //       buildGltfModelLayer(map, layerId, modelUrl, placements);
  //       customLayerIdsRef.current.push(layerId);
  //     };

  //     const floorFeatures = geo.features.filter(
  //       (f) => (f.properties?.floor ?? 0) === floor
  //     );

  //     const {
  //       rooms,
  //       boundaries,
  //       animals,
  //       sections,
  //       sponsorPoints,
  //       exhibitorPoints,
  //     } = splitFeatures(floorFeatures);
  //     const renderableRooms = rooms.filter(
  //       (feature) =>
  //         !isEscalatorPolygonFeature(feature) &&
  //         !isSittingAreaPolygonFeature(feature)
  //     );

  //     const topSections = sections.filter(
  //       (f) => !f.properties?.subSection && f.properties?.type !== "Sub Section"
  //     );
  //     const subSections = sections.filter(
  //       (f) =>
  //         f.properties?.subSection || f.properties?.type === "Sub Section"
  //     );

  //     const imagedPoints = floorFeatures.filter((f) => {
  //       const p = f.properties || {};
  //       return (
  //         f.geometry?.type === "Point" &&
  //         !p.sponsorRef &&
  //         !p.exhibitorRef &&
  //         !p.animalRef &&
  //         f.properties?.type !== "Section"
  //       );
  //     });

  //     markersRef.current.forEach((m) => m.remove());
  //     markersRef.current = [];

  //     const layers = map.getStyle()?.layers || [];
  //     layers.forEach((l) => {
  //       if (
  //         l.id.startsWith("floor_") ||
  //         l.id.startsWith("animal") ||
  //         l.id.startsWith("sponsor") ||
  //         l.id.startsWith("exhibitor") ||
  //         l.id.startsWith("point-image") ||
  //         l.id.startsWith("boundary-") ||
  //         l.id.startsWith("section-") ||
  //         l.id.startsWith("subsection-") ||
  //         l.id.startsWith("default-poi")
  //       ) {
  //         if (map.getLayer(l.id)) map.removeLayer(l.id);
  //       }
  //     });

  //     const sources = map.getStyle()?.sources || {};
  //     Object.keys(sources).forEach((id) => {
  //       if (
  //         id.startsWith("floor_") ||
  //         id === "animal-source" ||
  //         id.startsWith("sponsor") ||
  //         id.startsWith("exhibitor") ||
  //         id.startsWith("boundary-") ||
  //         id.startsWith("section-") ||
  //         id.startsWith("subsection-") ||
  //         id.startsWith("default-poi")
  //       ) {
  //         if (map.getSource(id)) map.removeSource(id);
  //       }
  //     });

  //     // 1. BOUNDARY BASE
  //     map.addSource(`boundary-base-src-${floor}`, {
  //       type: "geojson",
  //       data: { type: "FeatureCollection", features: boundaries },
  //     });
  //     map.addLayer({
  //       id: `boundary-base-${floor}`,
  //       type: "fill",
  //       source: `boundary-base-src-${floor}`,
  //       paint: { "fill-color": "#D4DBDD", "fill-opacity": 1 },
  //     });

  //     // 2. ROOMS (3D)
  //     map.addSource(`floor_${floor}_rooms`, {
  //       type: "geojson",
  //       data: { type: "FeatureCollection", features: renderableRooms },
  //     });
  //     map.addLayer({
  //       id: `floor_${floor}_rooms`,
  //       type: "fill-extrusion",
  //       source: `floor_${floor}_rooms`,
  //       minzoom: 16,
  //       paint: {
  //         "fill-extrusion-color": [
  //           "case",
  //           ["all", ["has", "fillColor"], ["!=", ["get", "fillColor"], "undefined"]],
  //           ["get", "fillColor"],
  //           ["==", ["get", "type"], "Accessible Washroom"],
  //           "#8EDB88",
  //           ["==", ["get", "type"], "Female Washroom"],
  //           "#8EDB88",
  //           ["==", ["get", "type"], "Male Washroom"],
  //           "#8EDB88",
  //           ["==", ["get", "type"], "Unisex Washroom"],
  //           "#8EDB88",
  //           ["==", ["get", "type"], "Drinking Water"],
  //           "#0277BD",
  //           ["==", ["get", "type"], "Food Lounge"],
  //           "#D84315",
  //           ["==", ["get", "type"], "Lift"],
  //           "#013975",
  //           ["==", ["get", "type"], "Stairs"],
  //           "#546E7A",
  //           ["==", ["get", "type"], "Steps"],
  //           "#B9BBBD",
  //           ["in", ["get", "type"], ["literal", ["Lab", "room", "Room", "Rooms"]]],
  //           "#FFC35D",
  //           ["==", ["get", "type"], "Office"],
  //           "#A38F9F",
  //           ["==", ["get", "type"], "Reception"],
  //           "#1976D2",
  //           ["==", ["get", "type"], "Booth"],
  //           "#8AE8F9",
  //           ["==", ["get", "type"], "Registration Counter"],
  //           "#7B1FA2",
  //           ["==", ["get", "type"], "Point of Interest"],
  //           "#C2185B",
  //           ["==", ["get", "type"], "Restricted Area"],
  //           "#BC9F7E",
  //           ["==", ["get", "type"], "Non Walkable"],
  //           "#424242",
  //           [
  //             "in",
  //             ["downcase", ["get", "type"]],
  //             ["literal", ["green area", "green area | pots"]],
  //           ],
  //           "#ADFA9E",
  //           ["==", ["get", "type"], "Wall"],
  //           "#DCDCDC",
  //           ["==", ["get", "type"], "Piller"],
  //           "#5D4037",
  //           ["==", ["get", "type"], "Terrace"],
  //           "#00695C",
  //           "#B9BBBD",
  //         ],
  //         "fill-extrusion-height": [
  //           "case",
  //           ["==", ["downcase", ["get", "type"]], "wall"],
  //           [
  //             "+",
  //             ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //             [
  //               "case",
  //               [
  //                 "all",
  //                 ["has", "height"],
  //                 ["!=", ["get", "height"], "undefined"],
  //                 [">", ["to-number", ["get", "height"]], 0],
  //               ],
  //               ["to-number", ["get", "height"]],
  //               3,
  //             ],
  //           ],
  //           ["==", ["get", "type"], "Booth"],
  //           ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 2],
  //           [
  //             "any",
  //             ["==", ["downcase", ["get", "type"]], "lift"],
  //             [
  //               "in",
  //               ["downcase", ["get", "type"]],
  //               [
  //                 "literal",
  //                 [
  //                   "cafeteria",
  //                   "piller",
  //                   "counter",
  //                   "security check",
  //                   "male washroom",
  //                   "female washroom",
  //                   "unisex washroom",
  //                   "drinking water",
  //                   "room",
  //                   "accessible washroom",
  //                 ],
  //               ],
  //             ],
  //           ],
  //           [
  //             "+",
  //             ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //             [
  //               "case",
  //               [
  //                 "all",
  //                 ["has", "height"],
  //                 ["!=", ["get", "height"], "undefined"],
  //                 [">", ["to-number", ["get", "height"]], 0],
  //               ],
  //               ["to-number", ["get", "height"]],
  //               2,
  //             ],
  //           ],
  //           [
  //             "in",
  //             ["downcase", ["get", "type"]],
  //             ["literal", ["green area", "green area | pots"]],
  //           ],
  //           ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 0.2],
  //           [
  //             "all",
  //             ["has", "height"],
  //             ["!=", ["get", "height"], "undefined"],
  //             [">", ["to-number", ["get", "height"]], 0],
  //           ],
  //           [
  //             "+",
  //             ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //             ["to-number", ["get", "height"]],
  //           ],
  //           ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //         ],
  //         "fill-extrusion-base": [
  //           "case",
  //           ["has", "baseHeight"],
  //           ["to-number", ["get", "baseHeight"]],
  //           0,
  //         ],
  //         "fill-extrusion-opacity": 1,
  //       },
  //     });

  //     // Add highlight layer for tapped polygons
  //     map.addSource(`floor_${floor}_highlight`, {
  //       type: "geojson",
  //       data: { type: "FeatureCollection", features: [] },
  //     });
  //     map.addLayer({
  //       id: `floor_${floor}_highlight`,
  //       type: "fill-extrusion",
  //       source: `floor_${floor}_highlight`,
  //       minzoom: 16,
  //       paint: {
  //         "fill-extrusion-color": "#4a4a4a",
  //         "fill-extrusion-height": [
  //           "case",
  //           ["==", ["downcase", ["get", "type"]], "wall"],
  //           [
  //             "+",
  //             ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //             [
  //               "case",
  //               [
  //                 "all",
  //                 ["has", "height"],
  //                 ["!=", ["get", "height"], "undefined"],
  //                 [">", ["to-number", ["get", "height"]], 0],
  //               ],
  //               ["to-number", ["get", "height"]],
  //               3,
  //             ],
  //           ],
  //           ["==", ["get", "type"], "Booth"],
  //           ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 2],
  //           [
  //             "any",
  //             ["==", ["downcase", ["get", "type"]], "lift"],
  //             [
  //               "in",
  //               ["downcase", ["get", "type"]],
  //               [
  //                 "literal",
  //                 [
  //                   "cafeteria",
  //                   "piller",
  //                   "counter",
  //                   "security check",
  //                   "male washroom",
  //                   "female washroom",
  //                   "unisex washroom",
  //                   "drinking water",
  //                   "room",
  //                   "accessible washroom",
  //                 ],
  //               ],
  //             ],
  //           ],
  //           [
  //             "+",
  //             ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //             [
  //               "case",
  //               [
  //                 "all",
  //                 ["has", "height"],
  //                 ["!=", ["get", "height"], "undefined"],
  //                 [">", ["to-number", ["get", "height"]], 0],
  //               ],
  //               ["to-number", ["get", "height"]],
  //               2,
  //             ],
  //           ],
  //           [
  //             "in",
  //             ["downcase", ["get", "type"]],
  //             ["literal", ["green area", "green area | pots"]],
  //           ],
  //           ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 0.2],
  //           [
  //             "all",
  //             ["has", "height"],
  //             ["!=", ["get", "height"], "undefined"],
  //             [">", ["to-number", ["get", "height"]], 0],
  //           ],
  //           [
  //             "+",
  //             ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //             ["to-number", ["get", "height"]],
  //           ],
  //           ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
  //         ],
  //         "fill-extrusion-base": [
  //           "case",
  //           ["has", "baseHeight"],
  //           ["to-number", ["get", "baseHeight"]],
  //           0,
  //         ],
  //         "fill-extrusion-opacity": 0.7,
  //       },
  //     });

  //     // ESCALATORS
  //     const escalatorPlacementsByModel = buildEscalatorPlacements(floorFeatures);
  //     Array.from(escalatorPlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {
  //       addTrackedGltfLayer(`escalator-model-3d-${floor}-${index}`, modelUrl, placements);
  //     });

  //     // SITTING AREAS
  //     const sittingAreaPlacementsByModel = buildSittingAreaPlacements(floorFeatures);
  //     Array.from(sittingAreaPlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {
  //       addTrackedGltfLayer(`sitting-area-model-3d-${floor}-${index}`, modelUrl, placements);
  //     });

  //     // TREES
  //     const treePlacementsByModel =
  //       buildTreePlacements(floorFeatures);

  //     Array.from(treePlacementsByModel.entries()).forEach(
  //       ([modelUrl, placements], index) => {
  //         addTrackedGltfLayer(
  //           `tree-model-3d-${floor}-${index}`,
  //           modelUrl,
  //           placements
  //         );
  //       }
  //     );
  //     // 3. SECTIONS (3D)
  //     map.addSource(`section-src-${floor}`, {
  //       type: "geojson",
  //       data: { type: "FeatureCollection", features: topSections },
  //     });
  //     map.addLayer({
  //       id: `floor_${floor}_sections`,
  //       type: "fill-extrusion",
  //       source: `section-src-${floor}`,
  //       minzoom: 16,
  //       maxzoom: 17,
  //       paint: {
  //         "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#ccc"],
  //         "fill-extrusion-height": [
  //           "case",
  //           ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
  //           ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
  //           ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 4],
  //         ],
  //         "fill-extrusion-base": [
  //           "case",
  //           ["has", "baseHeight"],
  //           ["to-number", ["get", "baseHeight"]],
  //           0,
  //         ],
  //         "fill-extrusion-opacity": 1,
  //       },
  //     });

  //     // 4. SUBSECTIONS (3D)
  //     map.addSource(`subsection-src-${floor}`, {
  //       type: "geojson",
  //       data: { type: "FeatureCollection", features: subSections },
  //     });
  //     map.addLayer({
  //       id: `floor_${floor}_subsections`,
  //       type: "fill-extrusion",
  //       source: `subsection-src-${floor}`,
  //       minzoom: 17,
  //       maxzoom: 18,
  //       paint: {
  //         "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#aaa"],
  //         "fill-extrusion-height": [
  //           "case",
  //           ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
  //           ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
  //           ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 4],
  //         ],
  //         "fill-extrusion-base": [
  //           "case",
  //           ["has", "baseHeight"],
  //           ["to-number", ["get", "baseHeight"]],
  //           0,
  //         ],
  //         "fill-extrusion-opacity": 1,
  //       },
  //     });

  //     // PATTERNS
  //     rooms.forEach((f, i) => {
  //       if (!f.properties?.pattern) return;
  //       const pat = addPatternImage(map, f.properties);
  //       const src = `pattern_${floor}_${i}`;
  //       map.addSource(src, {
  //         type: "geojson",
  //         data: { type: "FeatureCollection", features: [f] },
  //       });
  //       map.addLayer({
  //         id: src,
  //         type: "fill",
  //         source: src,
  //         paint: { "fill-pattern": pat },
  //       });
  //     });

  //     // 5. BOUNDARY LABEL LAYER
  //     const boundaryLabelFeatures = boundaries
  //       .filter((f) => f.properties?.name)
  //       .map((f) => ({
  //         type: "Feature",
  //         geometry: {
  //           type: "Point",
  //           coordinates:
  //             getPoleOfInaccessibility(f.geometry) ||
  //             getPolygonCenter(f.geometry),
  //         },
  //         properties: { name: f.properties.name },
  //       }))
  //       .filter((f) => f.geometry.coordinates);

  //     map.addSource(`boundary-label-src-${floor}`, {
  //       type: "geojson",
  //       data: { type: "FeatureCollection", features: boundaryLabelFeatures },
  //     });
  //     map.addLayer({
  //       id: `boundary-label-${floor}`,
  //       type: "symbol",
  //       source: `boundary-label-src-${floor}`,
  //       minzoom: 15,
  //       maxzoom: 16,
  //       layout: {
  //         "text-field": ["get", "name"],
  //         "text-size": 14,
  //         "text-anchor": "center",
  //         "text-offset": [0, 1.5],
  //         "text-allow-overlap": false,
  //       },
  //       paint: {
  //         "text-color": "#222",
  //         "text-halo-color": "#fff",
  //         "text-halo-width": 1.5,
  //       },
  //     });

  //     renderCurrentRoute();

  //     // 6. SECTION LABELS + LOGOS
  //     const sectionImageByPolygon = new Map();
  //     const sectionCentroidByPolygon = new Map();

  //     for (const f of floorFeatures) {
  //       const p = f.properties || {};
  //       if (f.geometry?.type !== "Point") continue;
  //       if (!Array.isArray(p.associatedPolygons)) continue;

  //       const isSection =
  //         p.type === "Section" &&
  //         !p.subSection &&
  //         p.polygonType !== "Sub Section";

  //       const centroid =
  //         p.centroid ||
  //         (f.geometry?.type === "Point" ? f.geometry.coordinates : null);

  //       for (const polyId of p.associatedPolygons) {
  //         const key = String(polyId);
  //         if (isSection) {
  //           if (p.imageFile) sectionImageByPolygon.set(key, p.imageFile);
  //           if (centroid) sectionCentroidByPolygon.set(key, centroid);
  //         } else {
  //           if (
  //             p.imageFile &&
  //             !sectionImageByPolygon.has(key)
  //           )
  //             sectionImageByPolygon.set(key, p.imageFile);
  //           if (
  //             centroid &&
  //             !sectionCentroidByPolygon.has(key)
  //           )
  //             sectionCentroidByPolygon.set(key, centroid);
  //         }
  //       }
  //     }

  //     const sectionSymbolFeatures = [];

  //     for (const section of topSections) {
  //       const p = section.properties || {};
  //       const sectionId = String(
  //         section.id || section._id || p.id || p._id || ""
  //       );

  //       const centroidCoords =
  //         sectionCentroidByPolygon.get(sectionId) || p.centroid || null;

  //       const center =
  //         (Array.isArray(centroidCoords) ? centroidCoords : null) ||
  //         getPoleOfInaccessibility(section.geometry) ||
  //         getPolygonCenter(section.geometry);

  //       if (!center || !p.name) continue;

  //       const rawImageFile =
  //         p.imageFile ||
  //         p.logo ||
  //         p.logoUrl ||
  //         sectionImageByPolygon.get(sectionId) ||
  //         "";

  //       const logoUrl = getImageFileUrl(rawImageFile);
  //       let iconId = null;

  //       if (logoUrl) {
  //         iconId = `section-icon-${logoUrl.split("/").pop().split("?")[0]}`;
  //         if (!map.hasImage(iconId)) {
  //           await new Promise((resolve) => {
  //             map.loadImage(logoUrl, (err, image) => {
  //               if (!err && image && !map.hasImage(iconId)) {
  //                 map.addImage(iconId, image);
  //               }
  //               resolve();
  //             });
  //           });
  //           if (!isCurrentRender()) return;
  //         }
  //       }

  //       if (!isCurrentRender()) return;
  //       sectionSymbolFeatures.push({
  //         type: "Feature",
  //         geometry: { type: "Point", coordinates: center },
  //         properties: { name: p.name, icon: iconId || "" },
  //       });
  //     }

  //     if (sectionSymbolFeatures.length) {
  //       map.addSource(`section-label-src-${floor}`, {
  //         type: "geojson",
  //         data: {
  //           type: "FeatureCollection",
  //           features: sectionSymbolFeatures,
  //         },
  //       });
  //       map.addLayer({
  //         id: `section-label-${floor}`,
  //         type: "symbol",
  //         source: `section-label-src-${floor}`,
  //         minzoom: 16,
  //         maxzoom: 17,
  //         layout: {
  //           "icon-image": ["case", ["!=", ["get", "icon"], ""], ["get", "icon"], ""],
  //           "icon-size": 0.15,
  //           "icon-anchor": "center",
  //           "icon-text-fit": "none",
  //           "text-field": ["get", "name"],
  //           "text-size": 12,
  //           "text-anchor": "left",
  //           "text-offset": [1.2, 0],
  //           "text-allow-overlap": true,
  //           "text-ignore-placement": true,
  //           "icon-allow-overlap": true,
  //           "icon-ignore-placement": true,
  //           "symbol-placement": "point",
  //         },
  //         paint: {
  //           "text-color": "#333",
  //           "text-halo-color": "#fff",
  //           "text-halo-width": 1.5,
  //         },
  //       });
  //     }

  //     // ANIMALS
  //     if (animals.length) {
  //       await renderAnimalMarkers(map, animals, markersRef, FIXED_GLB_SIZE_PX);
  //       if (!isCurrentRender()) return;
  //     }

  //     // LANDMARK GLB OBJECTS
  //     if (!isCurrentRender()) return;
  //     renderLandmarkGlbObjects(map, floorFeatures, markersRef, FIXED_GLB_SIZE_PX);

  //     // DEFAULT POI LAYER
  //     await renderDefaultPoiLayer(map, floorFeatures, floor, isCurrentRender);
  //     if (!isCurrentRender()) return;

  //     // TEXTURE + PLANE RENDERING
  //     const { textureCache, loadTexture } =
  //       initializeTextureCache();

  //     const polygonLookup = new Map();
  //     [...boundaries, ...rooms, ...topSections, ...subSections].forEach((feature) => {
  //       const keys = [
  //         feature.id,
  //         feature._id,
  //         feature.properties?.id,
  //         feature.properties?._id,
  //       ].filter(Boolean);
  //       keys.forEach((key) =>
  //         polygonLookup.set(String(key), feature)
  //       );
  //     });

  //     // BOUNDARY LOGOS
  //     const boundaryLogoPlanes = await buildBoundaryLogoPlanes(
  //       boundaries,
  //       loadTexture,
  //       BOUNDARY_LOGO_SIZE_M
  //     );
  //     if (!isCurrentRender()) return;

  //     if (boundaryLogoPlanes.length) {
  //       const boundaryLogoLayerId =
  //         `boundary-logo-3d-${floor}`;
  //       addTrackedLogoLayer(
  //         boundaryLogoLayerId,
  //         boundaryLogoPlanes
  //       );

  //       const updateBoundaryLogoVisibility = () => {
  //         const z = map.getZoom();
  //         const visible = z >= 15 && z < 16;
  //         if (map.getLayer(boundaryLogoLayerId)) {
  //           map.setLayoutProperty(
  //             boundaryLogoLayerId,
  //             "visibility",
  //             visible ? "visible" : "none"
  //           );
  //         }
  //       };
  //       updateBoundaryLogoVisibility();
  //       map.on("zoom", updateBoundaryLogoVisibility);
  //       zoomHandlers.push(updateBoundaryLogoVisibility);
  //     }

  //     // SPONSOR LOGOS
  //     const { logoPlanes: sponsorLogoPlanes } =
  //       await buildSponsorLogoPlanes(
  //         sponsorPoints,
  //         loadTexture,
  //         polygonLookup,
  //         buildPlanesForPolygons
  //       );
  //     if (!isCurrentRender()) return;

  //     if (sponsorLogoPlanes.length) {
  //       addTrackedLogoLayer(
  //         `sponsor-logo-3d-${floor}`,
  //         sponsorLogoPlanes
  //       );
  //     }

  //     // EXHIBITOR LOGOS
  //     const exhibitorLogoPlanes =
  //       await buildExhibitorLogoPlanes(
  //         exhibitorPoints,
  //         loadTexture,
  //         polygonLookup,
  //         buildPlanesForPolygons
  //       );
  //     if (!isCurrentRender()) return;

  //     if (exhibitorLogoPlanes.length) {
  //       addTrackedLogoLayer(
  //         `exhibitor-logo-3d-${floor}`,
  //         exhibitorLogoPlanes
  //       );
  //     }

  //     // POINT IMAGE PLANES
  //     const pointImagePlanes =
  //       await buildPointImagePlanes(
  //         imagedPoints,
  //         loadTexture,
  //         polygonLookup
  //       );
  //     if (!isCurrentRender()) return;

  //     if (pointImagePlanes.length) {
  //       addTrackedLogoLayer(
  //         `point-image-3d-${floor}`,
  //         pointImagePlanes
  //       );
  //     }

  //     if (!isCurrentRender()) return;

  //     setFloorRenderReady(true);
  //     renderCurrentRoute();
  //     updateMarkerVisibilityForFloor(floor);

  //     const navState = navStateRef.current;
  //     if (
  //       (navState.isNavigating || navState.showStepsPreview) &&
  //       routePathRef.current?.length
  //     ) {
  //       const pathPoints = routePathRef.current;
  //       const point = getPointForStep(
  //         pathPoints,
  //         navState.routeSteps,
  //         navState.routeStepIndex
  //       );
  //       if (point?.floor === floor) {
  //         const activeGlobalIndex =
  //           navState.routeSteps[navState.routeStepIndex]?.pointIndex ?? 0;
  //         updateNavigationRoute(map, pathPoints, floor, activeGlobalIndex);
  //       }
  //     }
  //   };

  //   if (!map.isStyleLoaded()) {
  //     map.once("load", render);
  //   } else {
  //     render();
  //   }

  //   return () => {
  //     cancelled = true;
  //     zoomHandlers.forEach((handler) => {
  //       map.off("zoom", handler);
  //     });
  //   };
  // }, [geo, floor, ready, routeRevision]);

  
 useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const onClick = (e) => {
      const features = map.queryRenderedFeatures(e.point);
      if (!features.length) return;
      const props = features[0].properties || {};
      if (
        props.type === "Boundary" ||
        props.type === "centroid" ||
        props.type === "Waypoint"
      )
        return;
        const geom = features[0].geometry;
      let coords;
      if (geom?.type === "Point") {
        coords = geom.coordinates; // [lng, lat]
      } else if (geom?.type === "Polygon") {
        // centroid of first ring
        const ring = geom.coordinates?.[0] || [];
        const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        coords = [lng, lat];
      } else if (geom?.type === "MultiPolygon") {
        const ring = geom.coordinates?.[0]?.[0] || [];
        const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        coords = [lng, lat];
      } else {
        coords = geom?.coordinates;
      }
      if (!coords || !Number.isFinite(coords[0])) return;

      const name =
        props.name ||
        props.title ||
        props.label ||
        props.animalName ||
        props.type ||
        "Unknown";

      const item = {
        matchedText: name,
        actualName: name,
        floorLabel: getFloorLabel(props.floor ?? floor),
        coord: coords,           // guaranteed [lng, lat]
        floor: props.floor ?? floor,
        feature: features[0],
      };

      // Update highlight - store the tapped feature in state
      setTappedFeature({ name, item, feature: features[0] });
      map.flyTo({ center: coords, zoom: 20 });
    };

    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [ready, floor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (tappedFeature?.feature?.geometry?.type === "Polygon") {
      const highlightSource = map.getSource(`floor_${floor}_highlight`);
      if (highlightSource) {
        highlightSource.setData({
          type: "FeatureCollection",
          features: [tappedFeature.feature],
        });
      }
    } else {
      const highlightSource = map.getSource(`floor_${floor}_highlight`);
      if (highlightSource) {
        highlightSource.setData({ type: "FeatureCollection", features: [] });
      }
    }
  }, [tappedFeature, floor, ready]);
  // Filter search results based on selected categories
  const filteredSearchResults = useMemo(() => {
    if (selectedCategories.length === 0) return destResults;
    
    return destResults.filter((result) => {
      const type = String(result.feature?.properties?.type || "").trim();
      return selectedCategories.some((cat) => type.includes(cat));
    });
  }, [destResults, selectedCategories]);

  // Update search handler to use filtered results
  const handleDestSearchWithFilter = async (val) => {
    setDestQuery(val);
    const results = await searchPlaces(val, geo, venueCenter);
    
    // Filter by selected categories if any
    if (selectedCategories.length > 0) {
      const filtered = results.filter((result) => {
        const type = String(result.feature?.properties?.type || "").trim();
        return selectedCategories.some((cat) => type.includes(cat));
      });
      setDestResults(filtered);
    } else {
      setDestResults(results);
    }
  };

useEffect(() => {
  const map = mapRef.current;
  if (!map || !ready) return;

  const layers = map.getStyle()?.layers || [];

  if (selectedCategories.length > 0) {
    console.log(selectedCategories);

    const filterExpression = [
      "match",
      ["get", "type"],
      selectedCategories,
      true,
      false,
    ];

    layers.forEach((layer) => {
      if (layer.id.startsWith("default-poi")) {
        map.setFilter(layer.id, filterExpression);
      }
    });
  } else {
    layers.forEach((layer) => {
      if (layer.id.startsWith("default-poi")) {
        map.setFilter(layer.id, null);
      }
    });
  }
}, [selectedCategories, ready]);
  // Search handlers
  const handleSourceSearch = async (val) => {
    setSourceQuery(val);
    const results = await searchPlaces(val, geo, venueCenter);
    setSourceResults(results);
  };

  const handleDestSearch = async (val) => {
    setDestQuery(val);
    const results = await searchPlaces(val, geo, venueCenter);
    setDestResults(results);
  };

  const handleSelectSource = (item) => {
  console.log("CALLER GEO SOURCE:", geo);
  syncPlaceParam("source", item);

  return selectSource(
    item,
    mapRef,
    sourceRef,
    sourceFloorRef,
    floor,
    switchFloor,
    getFeatureRoutingCoordinates,
    setSourceQuery,
    setSourceResults,
    destRef,
    handleRouting,
    updateMarkerVisibilityForFloor,
    geo
  );
};

const handleSelectDest = (item) => {
  console.log("CALLER GEO DEST:", geo);
setDestSelected(true);
  syncPlaceParam("destination", item);
  // Clear category filter when destination is selected
  setSelectedCategories([]);

  return selectDest(
    item,
    mapRef,
    destRef,
    destFloorRef,
    floor,
    switchFloor,
    getFeatureRoutingCoordinates,
    setDestQuery,
    setDestResults,
    sourceRef,
    handleRouting,
    updateMarkerVisibilityForFloor,
    geo
  );
};
  
// ?source=<featureId>&destination=<featureId> — preselect either end once the venue is loaded.
const urlPlacesAppliedRef = useRef(false);
useEffect(() => {
  if (!ready || !geo?.features?.length || urlPlacesAppliedRef.current) return;

  const params = new URLSearchParams(window.location.search);
  const sourceItem = findPlaceById(geo, params.get("source"));
  const destItem = findPlaceById(
    geo,
    params.get("destination") || params.get("dest")
  );

  if (!sourceItem && !destItem) return;
  urlPlacesAppliedRef.current = true;

  (async () => {
    if (sourceItem) {
      setDestSelected(true); // open the directions panel even if only a source was given
      await handleSelectSource(sourceItem);
    }
    if (destItem) await handleSelectDest(destItem);
  })();
}, [ready, geo]);

const handleSetTappedAsDest = () => {
    console.log("Tapped to set destination:", tappedFeature);
    
    if (!tappedFeature) return;
    handleSelectDest(tappedFeature.item);
    setTappedFeature(null);
  };
  const handleClearFilter = () => {
  setSelectedCategories([]);
};

  const handleCloseTappedPanel = () => {
    const map = mapRef.current;
    if (map) {
      const highlightSource = map.getSource(`floor_${floor}_highlight`);
      if (highlightSource) {
        highlightSource.setData({ type: "FeatureCollection", features: [] });
      }
    }
    setTappedFeature(null);
  };

const getIconForCategory = (type) => {
  const lowerType = String(type || "").toLowerCase();
  if (lowerType.includes("female washroom")) return "/assets/icons/femaleWashroom.png";
  if (lowerType.includes("male washroom")) return "/assets/icons/maleWashroom.png";
  if (lowerType.includes("accessible washroom")) return "/assets/icons/accessibleWashroom.png";
  if (lowerType.includes("unisex washroom")) return "/assets/icons/unisex_washroom.png";
  if (lowerType.includes("washroom")) return "/assets/icons/unisex_washroom.png"; // fallback
  if (lowerType.includes("water")) return "/assets/icons/water.png";
  if (lowerType.includes("food") || lowerType.includes("cafeteria")) return "/assets/icons/cafeteria.png";
  if (lowerType.includes("lift")) return "/assets/icons/lift.png";
  if (lowerType.includes("stair")) return "/assets/icons/stairs.png";
  // if (lowerType.includes("reception")) return "/assets/icons/reception.png";
  if (lowerType.includes("main entry")) return "/assets/icons/entry.png";
  if (lowerType.includes("exit only")) return "/assets/icons/exit.png";
  if (lowerType.includes("parking")) return "/assets/icons/parking.png";
  // if (lowerType.includes("registration")) return "/assets/icons/reception.png";
  return null;
};
  // Extract unique POI categories from venue data
  const poiCategories = useMemo(() => {
    if (!geo || !geo.features) return [];
    
    const categories = new Map();
    const categoryOrder = [
      "Washroom",
      "Drinking Water",
      "Food & Beverage",
      "Lift",
      "Stairs",
      "Parking",
      "Information",
    ];

    geo.features.forEach((f) => {
      const props = f.properties || {};
      const type = String(props.type || props.polygonType || "").trim();
      
      if (!type || f.geometry?.type !== "Point") return;
      
      // Skip waypoints, centroids, etc
      if (type.includes("Waypoint") || type.includes("centroid") || type.includes("Restricted")) return;
      
      // Only include if it has a specific icon
      const icon = getIconForCategory(type);
      if (!icon) return; // Skip types without specific icons
      
      if (!categories.has(type)) {
        categories.set(type, {
          name: type,
          label: type,
          count: 0,
          icon: icon,
        });
      }
      categories.get(type).count += 1;
    });

    // Sort by predefined order, then alphabetically
    return Array.from(categories.values()).sort((a, b) => {
      const aIdx = categoryOrder.indexOf(a.name);
      const bIdx = categoryOrder.indexOf(b.name);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [geo]);

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <IndoorMapUI
        sourceQuery={sourceQuery}
        destQuery={destQuery}
        sourceResults={sourceResults}
        destResults={destResults}
        venueData={venueData}
        floor={floor}
        destSelected={destSelected}
        onSourceSearch={handleSourceSearch}
        onDestSearch={handleDestSearchWithFilter}
        onSourceSelect={handleSelectSource}
        onDestSelect={handleSelectDest}
        onFloorSwitch={handleFloorSwitch}
        routeSummary={routeSummary}
        onOpenSteps={openStepsPreview}
        onCloseSteps={closeStepsPreview}
        onStartNavigation={startNavigation}
        onEndNavigation={endNavigation}
        onClearDirections={clearDirections}
        onPreviousStep={() => moveToRouteStep(routeStepIndex - 1)}
        onNextStep={() => moveToRouteStep(routeStepIndex + 1)}
        containerRef={containerRef}
        tappedFeature={tappedFeature}
        parking={parking}
        markingParking={markingParking}
        onStartMarkParking={startMarkParking}
        onStopMarkParking={stopMarkParking}
        onSetParkingAsDest={() => {
          if (!parking || !parking.coord) return;
          const item = {
            matchedText: "My Parking",
            actualName: "My Parking",
            floorLabel: parking.floorLabel || getFloorLabel(parking.floor || floor),
            coord: parking.coord,
            floor: parking.floor ?? floor,
            feature: null,
          };
          handleSelectDest(item);
        }}
          onDeleteParking={() => {
            try {
              localStorage.removeItem("my_parking");
            } catch (e) {}
            setParking(null);
            if (parkingMarkerRef.current) {
              parkingMarkerRef.current.remove();
              parkingMarkerRef.current = null;
            }
          }}
        onSetTappedAsDest={handleSetTappedAsDest}
        onCloseTappedPanel={handleCloseTappedPanel}
        poiCategories={poiCategories}
        selectedCategories={selectedCategories}
        onClearFilter={handleClearFilter}
        onCategoryToggle={(category) => {
          setSelectedCategories((prev) =>
            prev.includes(category.name)
              ? prev.filter((c) => c !== category.name)
              : [...prev, category.name]
          );
        }}
      />
    </div>
  );
}
