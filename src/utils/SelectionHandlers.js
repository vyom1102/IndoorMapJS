import maplibregl from "maplibre-gl";

// Green source pin with a "You are here" caption hanging off its tip.
const createSourceMarker = (map, coords) => {
  const marker = new maplibregl.Marker({ color: "green" })
    .setLngLat(coords)
    .addTo(map);

  const label = document.createElement("div");
  label.textContent = "You are here";

  Object.assign(label.style, {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginTop: "2px",
    padding: "2px 8px",
    borderRadius: "10px",
    background: "rgba(255, 255, 255, 0.95)",
    color: "#14532d",
    fontSize: "11px",
    fontWeight: "700",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.18)",
    pointerEvents: "none",
  });

  marker.getElement().appendChild(label);

  return marker;
};

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
  updateMarkerVisibilityForFloor,
  geo
) => {
  const map = mapRef.current;

  if (!map) return;

  if (item.googlePlace) {
    const g = item.googlePlace;

    const nearestExit = findNearestExit(g.location, geo);

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
      sourceRef.current = createSourceMarker(map, coords);
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
    sourceRef.current = createSourceMarker(map, coords);
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
  updateMarkerVisibilityForFloor,
  geo
) => {
  console.log("======== DEST CLICK ========");
  console.log("ITEM:", item);

  const map = mapRef.current;

  console.log("MAP:", map);

  if (!map) {
    console.log("NO MAP");
    return;
  }

  // OUTDOOR PLACE
  if (item.googlePlace) {
    console.log("OUTDOOR PLACE CLICKED");

    const g = item.googlePlace;

    console.log("GOOGLE PLACE:", g);

    console.log("GEO:", geo);

    console.log(
      "TOTAL FEATURES:",
      geo?.features?.length
    );

    const nearestExit =
      findNearestExit(
        g.location,
        geo
      );

    console.log(
      "NEAREST EXIT:",
      nearestExit
    );

    if (!nearestExit) {
      console.log(
        "NO EXIT FOUND"
      );

      return;
    }

    const coords =
      nearestExit.coords;

    const targetFloor =
      nearestExit.floor ?? 0;

    console.log(
      "EXIT COORDS:",
      coords
    );

    console.log(
      "TARGET FLOOR:",
      targetFloor
    );

    destFloorRef.current =
      targetFloor;

    if (
      targetFloor !== floor
    ) {
      console.log(
        "SWITCHING FLOOR"
      );

      await switchFloor(
        targetFloor
      );
    }

    console.log(
      "CREATING MARKER"
    );

    if (!destRef.current) {
      destRef.current =
        new maplibregl.Marker({
          color: "red",
        })
          .setLngLat(coords)
          .addTo(map);

      console.log(
        "NEW MARKER CREATED"
      );
    } else {
      destRef.current.setLngLat(
        coords
      );

      updateMarkerVisibilityForFloor(
        targetFloor
      );

      console.log(
        "UPDATED EXISTING MARKER"
      );
    }

    setDestQuery(g.name);

    setDestResults([]);

    console.log(
      "FLYING TO:",
      g.location
    );

    map.flyTo({
      center: [
        g.location.lng,
        g.location.lat,
      ],
      zoom: 18,
    });

    console.log(
      "SOURCE REF:",
      sourceRef.current
    );

    console.log(
      "DEST REF:",
      destRef.current
    );

    if (
      sourceRef.current &&
      destRef.current
    ) {
      console.log(
        "CALLING ROUTING"
      );

      routeAfterFloorUpdate(
        handleRouting
      );
    }

    return;
  }

  // DIRECT COORDINATE (e.g. My Parking saved location)
  if (item.coord && Array.isArray(item.coord) && item.coord.length >= 2) {
    console.log("DIRECT COORD CLICKED", item.coord);
    const coords = [Number(item.coord[0]), Number(item.coord[1])];
    const targetFloor = item.floor ?? 0;

    destFloorRef.current = targetFloor;

    if (targetFloor !== floor) {
      console.log("SWITCHING FLOOR FOR COORD", targetFloor);
      await switchFloor(targetFloor);
    }

    if (!destRef.current) {
      destRef.current = new maplibregl.Marker({ color: "red" })
        .setLngLat(coords)
        .addTo(map);
    } else {
      destRef.current.setLngLat(coords);
      updateMarkerVisibilityForFloor(targetFloor);
    }

    setDestQuery(item.matchedText || item.actualName || "Destination");
    setDestResults([]);

    try {
      map.flyTo({ center: coords, zoom: 20 });
    } catch (e) {}

    if (sourceRef.current && destRef.current) {
      routeAfterFloorUpdate(handleRouting);
    }

    return;
  }

  console.log(
    "INDOOR FEATURE CLICK"
  );

  const feature =
    item.feature;

  console.log(
    "FEATURE:",
    feature
  );

  const coords =
    getFeatureRoutingCoordinates(
      feature
    );

  console.log(
    "FEATURE COORDS:",
    coords
  );
  if (!coords) {
    console.log(
      "NO ROUTING COORDS"
    );

    return;
  }

  const targetFloor =
    feature.properties?.floor ??
    0;

  destFloorRef.current =
    targetFloor;

  if (
    targetFloor !== floor
  ) {
    await switchFloor(
      targetFloor
    );
  }

  if (!destRef.current) {
let lngLat;

if (Array.isArray(coords)) {
  lngLat = [Number(coords[0]), Number(coords[1])];
}
else if (typeof coords === "string") {
  const parsed = JSON.parse(coords);

  lngLat = [
    Number(parsed[0]),
    Number(parsed[1]),
  ];
}
else {
  lngLat = [
    Number(coords.lng ?? coords.lon),
    Number(coords.lat),
  ];
}
destRef.current =new maplibregl.Marker({ color: "red" })
  .setLngLat(lngLat)
  .addTo(map);
  } else {
let lngLat;

if (Array.isArray(coords)) {
  lngLat = [Number(coords[0]), Number(coords[1])];
}
else if (typeof coords === "string") {
  const parsed = JSON.parse(coords);

  lngLat = [
    Number(parsed[0]),
    Number(parsed[1]),
  ];
}
else {
  lngLat = [
    Number(coords.lng ?? coords.lon),
    Number(coords.lat),
  ];
}
destRef.current.setLngLat(lngLat);
    updateMarkerVisibilityForFloor(
      targetFloor
    );
  }
  console.log(
    "DEST QUERY:",
    feature.properties);
  setDestQuery(
    feature.properties
      ?.renderName ||
      feature.properties
        ?.name ||
        feature.properties.type ||
      "Destination"
  );

  setDestResults([]);

  map.flyTo({
    center: coords,
    zoom: 20,
  });

  if (
    sourceRef.current &&
    destRef.current
  ) {
    routeAfterFloorUpdate(
      handleRouting
    );
  }
};
