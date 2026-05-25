import maplibregl from "maplibre-gl";

const routeAfterFloorUpdate = (handleRouting) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      handleRouting();
    });
  });
};

export const findNearestExit = (targetCoords, geo) => {
  if (!geo) return null;

  let nearest = null;
  let minDist = Infinity;

  for (const f of geo.features) {
    const p = f.properties || {};

    const type = String(p.type || p.polygonType || "").toLowerCase();

    const isMainEntry =
      type.includes("main entry") || type.includes("main entrance");

    const isExitOnly = type.includes("exit only");
    const isEmergencyExit = type.includes("emergency exit");

    const isExit = (isMainEntry || isExitOnly) && !isEmergencyExit;

    if (!isExit) continue;

    const coords = p.centroid || f.geometry?.coordinates;

    if (!coords) continue;

    const dx = coords[0] - targetCoords.lng;
    const dy = coords[1] - targetCoords.lat;

    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist) {
      minDist = dist;
      nearest = {
        feature: f,
        coords,
        floor: p.floor ?? 0,
      };
    }
  }

  console.log(nearest);

  return nearest;
};

export const selectSource = async (
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
  updateMarkerVisibilityForFloor
) => {
  const map = mapRef.current;

  if (!map) return;

  if (item.googlePlace) {
    const g = item.googlePlace;

    const nearestExit = findNearestExit(g.location, { features: [] });

    if (!nearestExit) {
      return;
    }

    const coords = nearestExit.coords;
    const targetFloor = nearestExit.floor ?? 0;

    sourceFloorRef.current = targetFloor;

    if (targetFloor !== floor) {
      await switchFloor(targetFloor);
    }

    if (!sourceRef.current) {
      sourceRef.current = new maplibregl.Marker({
        color: "green",
      })
        .setLngLat(coords)
        .addTo(map);
    } else {
      sourceRef.current.setLngLat(coords);
      updateMarkerVisibilityForFloor(targetFloor);
    }

    setSourceQuery(g.name);
    setSourceResults([]);

    map.flyTo({
      center: [g.location.lng, g.location.lat],
      zoom: 18,
    });

    if (sourceRef.current && destRef.current) {
      routeAfterFloorUpdate(handleRouting);
    }

    return;
  }

  const feature = item.feature;
  const coords = getFeatureRoutingCoordinates(feature);

  if (!coords) return;

  const targetFloor = feature.properties?.floor ?? 0;

  sourceFloorRef.current = targetFloor;

  if (targetFloor !== floor) {
    await switchFloor(targetFloor);
  }

  if (!sourceRef.current) {
    sourceRef.current = new maplibregl.Marker({
      color: "green",
    })
      .setLngLat(coords)
      .addTo(map);
  } else {
    sourceRef.current.setLngLat(coords);
    updateMarkerVisibilityForFloor(targetFloor);
  }

  setSourceQuery(
    feature.properties?.renderName || feature.properties?.name || ""
  );

  setSourceResults([]);

  map.flyTo({
    center: coords,
    zoom: 20,
  });

  if (sourceRef.current && destRef.current) {
    routeAfterFloorUpdate(handleRouting);
  }
};

export const selectDest = async (
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
  updateMarkerVisibilityForFloor
) => {
  const map = mapRef.current;

  if (!map) return;

  if (item.googlePlace) {
    const g = item.googlePlace;

    const nearestExit = findNearestExit(g.location, { features: [] });

    if (!nearestExit) {
      return;
    }

    const coords = nearestExit.coords;
    const targetFloor = nearestExit.floor ?? 0;

    destFloorRef.current = targetFloor;

    if (targetFloor !== floor) {
      await switchFloor(targetFloor);
    }

    if (!destRef.current) {
      destRef.current = new maplibregl.Marker({
        color: "red",
      })
        .setLngLat(coords)
        .addTo(map);
    } else {
      destRef.current.setLngLat(coords);
      updateMarkerVisibilityForFloor(targetFloor);
    }

    setDestQuery(g.name);
    setDestResults([]);

    map.flyTo({
      center: [g.location.lng, g.location.lat],
      zoom: 18,
    });

    if (sourceRef.current && destRef.current) {
      routeAfterFloorUpdate(handleRouting);
    }

    return;
  }

  const feature = item.feature;
  const coords = getFeatureRoutingCoordinates(feature);

  if (!coords) return;

  const targetFloor = feature.properties?.floor ?? 0;

  destFloorRef.current = targetFloor;

  if (targetFloor !== floor) {
    await switchFloor(targetFloor);
  }

  if (!destRef.current) {
    destRef.current = new maplibregl.Marker({
      color: "red",
    })
      .setLngLat(coords)
      .addTo(map);
  } else {
    destRef.current.setLngLat(coords);
    updateMarkerVisibilityForFloor(targetFloor);
  }

  setDestQuery(
    feature.properties?.renderName || feature.properties?.name || ""
  );

  setDestResults([]);

  map.flyTo({
    center: coords,
    zoom: 20,
  });

  if (sourceRef.current && destRef.current) {
    routeAfterFloorUpdate(handleRouting);
  }
};
