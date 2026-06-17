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
