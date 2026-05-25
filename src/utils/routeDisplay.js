import maplibregl from "maplibre-gl";

const ROUTE_LAYERS = [
  "route-arrows-route-remaining",
  "route-arrows-route-traveled",
  "route-arrows",
  "route-line",
  "route-traveled",
  "route-remaining",
  "route-point",
];

const ROUTE_SOURCES = [
  "route",
  "route-traveled",
  "route-remaining",
  "route-point",
];

export const isValidCoord = (coord) =>
  Array.isArray(coord) &&
  coord.length >= 2 &&
  Number.isFinite(coord[0]) &&
  Number.isFinite(coord[1]);

const toRad = (value) => (value * Math.PI) / 180;

export const bearing = (from, to) => {
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

const lineFeature = (coordinates) => ({
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates,
  },
});

const emptyCollection = () => ({
  type: "FeatureCollection",
  features: [],
});

export const ensureRouteArrowImage = (map) => {
  if (map.hasImage("route-arrow")) return;

  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(size * 0.15, size * 0.12);
  ctx.lineTo(size * 0.88, size * 0.5);
  ctx.lineTo(size * 0.15, size * 0.88);
  ctx.closePath();
  ctx.fill();

  const imageData = ctx.getImageData(0, 0, size, size);
  map.addImage("route-arrow", imageData, { pixelRatio: 2 });
};

const upsertGeojsonSource = (map, sourceId, data) => {
  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(data);
  } else {
    map.addSource(sourceId, { type: "geojson", data });
  }
};

const addLineLayer = (map, layerId, sourceId, color, width = 6) => {
  if (map.getLayer(layerId)) return;
  map.addLayer({
    id: layerId,
    type: "line",
    source: sourceId,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": color,
      "line-width": width,
    },
  });
};

const addArrowLayer = (map, sourceId) => {
  const layerId = `route-arrows-${sourceId}`;
  if (map.getLayer(layerId)) return;
  ensureRouteArrowImage(map);
  map.addLayer({
    id: layerId,
    type: "symbol",
    source: sourceId,
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 24,
      "icon-image": "route-arrow",
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-rotation-alignment": "map",
    },
  });
};

const getFloorPathPoints = (pathCoords, targetFloor) =>
  pathCoords
    .map((point, globalIndex) => ({ ...point, globalIndex }))
    .filter((point) => point.floor === targetFloor && isValidCoord(point.coord));

const getSplitIndex = (floorPoints, activeGlobalIndex) => {
  let splitIndex = 0;
  floorPoints.forEach((point, index) => {
    if (point.globalIndex <= activeGlobalIndex) {
      splitIndex = index;
    }
  });
  return splitIndex;
};

export const removeRouteLayers = (map) => {
  if (!map) return;
  ROUTE_LAYERS.forEach((layerId) => {
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    } catch {
      /* ignore */
    }
  });
  ROUTE_SOURCES.forEach((sourceId) => {
    try {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch {
      /* ignore */
    }
  });
};

const ensureRouteLayers = (map) => {
  addLineLayer(map, "route-traveled", "route-traveled", "#b8bec8", 8);
  addLineLayer(map, "route-remaining", "route-remaining", "#007aff", 8);
  addArrowLayer(map, "route-traveled");
  addArrowLayer(map, "route-remaining");
};

export const renderPlannedRoute = (map, pathCoords, targetFloor) => {
  if (!map || !pathCoords?.length) return;

  removeRouteLayers(map);

  const floorPoints = getFloorPathPoints(pathCoords, targetFloor);
  const coords = floorPoints.map((p) => p.coord);
  if (!coords.length) return;

  if (coords.length === 1) {
    upsertGeojsonSource(map, "route-point", {
      type: "Feature",
      geometry: { type: "Point", coordinates: coords[0] },
    });
    if (!map.getLayer("route-point")) {
      map.addLayer({
        id: "route-point",
        type: "circle",
        source: "route-point",
        paint: {
          "circle-radius": 9,
          "circle-color": "#007aff",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 4,
        },
      });
    }
    return;
  }

  upsertGeojsonSource(map, "route-remaining", lineFeature(coords));
  addLineLayer(map, "route-remaining", "route-remaining", "#007aff", 6);
  addArrowLayer(map, "route-remaining");
};

export const updateNavigationRoute = (
  map,
  pathCoords,
  targetFloor,
  activeGlobalIndex
) => {
  if (!map || !pathCoords?.length) return false;

  removeRouteLayers(map);

  const floorPoints = getFloorPathPoints(pathCoords, targetFloor);
  if (!floorPoints.length) return false;

  const splitIndex = getSplitIndex(floorPoints, activeGlobalIndex);
  const traveledCoords = floorPoints
    .slice(0, splitIndex + 1)
    .map((p) => p.coord);
  const remainingCoords = floorPoints.slice(splitIndex).map((p) => p.coord);

  upsertGeojsonSource(map, "route-traveled", emptyCollection());
  upsertGeojsonSource(map, "route-remaining", emptyCollection());

  ensureRouteLayers(map);

  if (traveledCoords.length >= 2) {
    map.getSource("route-traveled").setData(lineFeature(traveledCoords));
  }

  if (remainingCoords.length >= 2) {
    map.getSource("route-remaining").setData(lineFeature(remainingCoords));
  } else if (remainingCoords.length === 1 && traveledCoords.length >= 1) {
    const merged = [...traveledCoords, ...remainingCoords];
    map.getSource("route-remaining").setData(lineFeature(merged));
  }

  return true;
};

export const getActiveRoutePoint = (pathCoords, activeGlobalIndex, targetFloor) => {
  const point = pathCoords[activeGlobalIndex];
  if (point?.floor === targetFloor && isValidCoord(point?.coord)) return point;

  for (let i = activeGlobalIndex; i >= 0; i -= 1) {
    if (
      pathCoords[i]?.floor === targetFloor &&
      isValidCoord(pathCoords[i]?.coord)
    ) {
      return pathCoords[i];
    }
  }

  return getFloorPathPoints(pathCoords, targetFloor)[0] || null;
};

export const getLookAheadCoord = (pathCoords, activeGlobalIndex, targetFloor) => {
  for (let i = activeGlobalIndex + 1; i < pathCoords.length; i += 1) {
    if (
      pathCoords[i]?.floor === targetFloor &&
      isValidCoord(pathCoords[i]?.coord)
    ) {
      return pathCoords[i].coord;
    }
  }

  for (let i = activeGlobalIndex - 1; i >= 0; i -= 1) {
    if (
      pathCoords[i]?.floor === targetFloor &&
      isValidCoord(pathCoords[i]?.coord)
    ) {
      return pathCoords[i].coord;
    }
  }

  return null;
};

const NAV_CAMERA_PADDING = { top: 120, bottom: 90, left: 400, right: 90 };

export const followCameraBehindPointer = (
  map,
  pathCoords,
  activeGlobalIndex,
  targetFloor
) => {
  if (!map) return;

  const currentPoint = getActiveRoutePoint(
    pathCoords,
    activeGlobalIndex,
    targetFloor
  );
  if (!currentPoint) return;

  const lookAhead = getLookAheadCoord(
    pathCoords,
    activeGlobalIndex,
    targetFloor
  );
  const routeBearing = lookAhead
    ? bearing(currentPoint.coord, lookAhead)
    : map.getBearing();

  map.easeTo({
    center: currentPoint.coord,
    bearing: routeBearing,
    pitch: 62,
    zoom: Math.max(map.getZoom(), 20),
    duration: 1000,
    essential: true,
    padding: NAV_CAMERA_PADDING,
  });
};

export const renderRouteForFloor = (map, pathCoords, targetFloor, options = {}) => {
  if (!map || !pathCoords?.length) return;

  const { navigationMode = false, activeGlobalIndex = 0 } = options;

  if (navigationMode) {
    updateNavigationRoute(map, pathCoords, targetFloor, activeGlobalIndex);
    return;
  }

  renderPlannedRoute(map, pathCoords, targetFloor);

  const floorPoints = getFloorPathPoints(pathCoords, targetFloor);
  if (floorPoints.length > 1 && !navigationMode) {
    const bounds = new maplibregl.LngLatBounds();
    floorPoints.forEach((p) => bounds.extend(p.coord));
    map.fitBounds(bounds, {
      padding: 80,
      duration: 800,
      maxZoom: 20,
      pitch: 45,
    });
  }
};
