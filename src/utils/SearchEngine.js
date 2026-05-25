export const searchGoogleNearbyPlaces = async (query, mapRef) => {
  try {
    const map = mapRef.current;
    const center = map?.getCenter();

    if (!center) return [];

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query
    )}&lat=${center.lat}&lon=${center.lng}&limit=8`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data?.features) {
      return [];
    }

    return data.features.map((f) => {
      const p = f.properties || {};

      return {
        isGooglePlace: true,
        name: p.name || p.street || query,
        address: [p.city, p.state, p.country].filter(Boolean).join(", "),
        location: {
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        },
        type: p.osm_value || p.type || "",
      };
    });
  } catch (e) {
    console.log("Free places API error", e);
    return [];
  }
};

export const searchPlaces = async (query, geo) => {
  if (!geo || !query) return [];

  const q = query.toLowerCase().trim();
  const seen = new Set();
  const results = [];

  for (const f of geo.features) {
    const p = f.properties || {};

    if (!p) continue;

    if (f.geometry?.type !== "Point") {
      continue;
    }

    const type = String(p.type || p.polygonType || "").toLowerCase();
    const name = String(p.name || "").toLowerCase();

    const shouldIgnore =
      type.includes("waypoint") ||
      type.includes("centroid") ||
      type.includes("restricted area") ||
      type.includes("beacon") ||
      name.includes("waypoint") ||
      name.includes("centroid") ||
      name.includes("restricted area") ||
      name.includes("beacon");

    if (shouldIgnore) continue;

    if (!p.name && !p.renderName) {
      continue;
    }

    const renderName = String(p.renderName || "").trim();
    const keywords = Array.isArray(p.keywords) ? p.keywords : [];

    const matchedKeyword = keywords.find((k) =>
      String(k).toLowerCase().includes(q)
    );

    const matched =
      name.includes(q) ||
      renderName.toLowerCase().includes(q) ||
      matchedKeyword;

    if (!matched) continue;

    const uniqueKey = p.landmarkId || f.id || name;

    if (seen.has(uniqueKey)) continue;

    seen.add(uniqueKey);

    const floorNo = p.floor ?? 0;

    let floorLabel = "";

    if (floorNo < 0) {
      floorLabel = `B${Math.abs(floorNo)}`;
    } else if (floorNo === 0) {
      floorLabel = "G";
    } else {
      floorLabel = `F${floorNo}`;
    }

    results.push({
      feature: f,
      matchedText: matchedKeyword || renderName || name,
      actualName: renderName || name,
      floorLabel,
    });

    if (results.length >= 10) break;
  }

  if (results.length === 0) {
    const googlePlaces = await searchGoogleNearbyPlaces(query, { current: geo });

    googlePlaces.forEach((g) => {
      results.push({
        googlePlace: g,
        matchedText: g.name,
        actualName: g.address,
        floorLabel: "Outside",
      });
    });
  }

  return results.slice(0, 15);
};
