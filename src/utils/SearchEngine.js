// import { getDefaultVenueCenter } from "../constants/mapDefaults";

// export const searchGoogleNearbyPlaces = async (query, venueCenter) => {
//   try {
//     const center = venueCenter || getDefaultVenueCenter();

//     const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
//       query
//     )}&lat=${center.lat}&lon=${center.lng}&limit=8`;

//     const res = await fetch(url);
//     const data = await res.json();

//     if (!data?.features) {
//       return [];
//     }

//     return data.features.map((f) => {
//       const p = f.properties || {};

//       return {
//         isGooglePlace: true,
//         name: p.name || p.street || query,
//         address: [p.city, p.state, p.country].filter(Boolean).join(", "),
//         location: {
//           lng: f.geometry.coordinates[0],
//           lat: f.geometry.coordinates[1],
//         },
//         type: p.osm_value || p.type || "",
//       };
//     });
//   } catch (e) {
//     console.log("Free places API error", e);
//     return [];
//   }
// };

// export const searchPlaces = async (query, geo, venueCenter) => {
//   if (!geo || !query) return [];

//   const q = query.toLowerCase().trim();
//   const seen = new Set();
//   const results = [];

//   for (const f of geo.features) {
//     const p = f.properties || {};

//     if (!p) continue;

//     if (f.geometry?.type !== "Point") {
//       continue;
//     }

//     const type = String(p.type || p.polygonType || "").toLowerCase();
//     const name = String(p.name || "").toLowerCase();

//     const shouldIgnore =
//       type.includes("waypoint") ||
//       type.includes("centroid") ||
//       type.includes("restricted area") ||
//       type.includes("beacon") ||
//       name.includes("waypoint") ||
//       name.includes("centroid") ||
//       name.includes("restricted area") ||
//       name.includes("beacon");

//     if (shouldIgnore) continue;

//     if (!p.name && !p.renderName) {
//       continue;
//     }

//     const renderName = String(p.renderName || "").trim();
//     const keywords = Array.isArray(p.keywords) ? p.keywords : [];

//     const matchedKeyword = keywords.find((k) =>
//       String(k).toLowerCase().includes(q)
//     );

//     const matched =
//       name.includes(q) ||
//       renderName.toLowerCase().includes(q) ||
//       matchedKeyword;

//     if (!matched) continue;


//     const uniqueKey = p.landmarkId || f.id || name;

//     if (seen.has(uniqueKey)) continue;

//     seen.add(uniqueKey);

//     const floorNo = p.floor ?? 0;

//     let floorLabel = "";

//     if (floorNo < 0) {
//       floorLabel = `B${Math.abs(floorNo)}`;
//     } else if (floorNo === 0) {
//       floorLabel = "G";
//     } else {
//       floorLabel = `F${floorNo}`;
//     }

//     results.push({
//       feature: f,
//       matchedText: matchedKeyword || renderName || name,
//       actualName: renderName || name,
//       floorLabel,
//     });

//     if (results.length >= 10) break;
//   }

//   if (results.length === 0) {
//     const googlePlaces = await searchGoogleNearbyPlaces(query, venueCenter);

//     googlePlaces.forEach((g) => {
//       results.push({
//         googlePlace: g,
//         matchedText: g.name,
//         actualName: g.address,
//         floorLabel: "Outside",
//       });
//     });
//   }

//   return results.slice(0, 15);
// };
import { getDefaultVenueCenter } from "../constants/mapDefaults";

const distanceInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const searchGoogleNearbyPlaces = async (
  query,
  venueCenter
) => {
  try {
    const center =
      venueCenter || getDefaultVenueCenter();

    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(
        query
      )}&lat=${center.lat}&lon=${center.lng}&limit=20`;

    const res =
      await fetch(url);

    const data =
      await res.json();

    if (!data?.features) {
      return [];
    }

    return data.features
      .filter((f) => {
        const lng =
          f.geometry?.coordinates?.[0];

        const lat =
          f.geometry?.coordinates?.[1];

        if (!lng || !lat) {
          return false;
        }

        const dist =
          distanceInKm(
            center.lat,
            center.lng,
            lat,
            lng
          );

        return dist <= 3;
      })
      .map((f) => {
        const p =
          f.properties || {};

        return {
          isGooglePlace: true,

          name:
            p.name ||
            p.street ||
            query,

          address: [
            p.city,
            p.state,
            p.country,
          ]
            .filter(Boolean)
            .join(", "),

          location: {
            lng:
              f.geometry.coordinates[0],
            lat:
              f.geometry.coordinates[1],
          },

          type:
            p.osm_value ||
            p.type ||
            "",
        };
      });
  } catch (e) {
    console.log(
      "Free places API error",
      e
    );

    return [];
  }
};

// The id a feature is addressable by in the ?source=/?destination= URL params.
export const getPlaceId = (feature) => {
  const p = feature?.properties || {};

  const id = [feature?.id, feature?._id, p.id, p._id, p.landmarkId].find(
    (v) => v != null && v !== ""
  );

  return id == null ? null : String(id);
};

// Find a feature by any of the ids it may carry (used by the ?source=/?destination= URL params).
export const findPlaceById = (geo, id) => {
  if (!geo?.features || !id) return null;

  const target = String(id).trim();

  const feature = geo.features.find((f) => {
    const p = f.properties || {};

    return [f.id, f._id, p.id, p._id, p.landmarkId].some(
      (v) => v != null && String(v) === target
    );
  });

  return feature ? { feature } : null;
};

export const searchPlaces = async (
  query,
  geo,
  venueCenter
) => {
  if (!geo || !query) {
    return [];
  }

  const q =
    query.toLowerCase().trim();

  const seen =
    new Set();

  const results = [];

  for (const f of geo.features) {
    const p =
      f.properties || {};

    if (!p) continue;

    if (
      f.geometry?.type !== "Point"
    ) {
      continue;
    }

    const type =
      String(
        p.type ||
          p.polygonType ||
          ""
      ).toLowerCase();

    const rawName =
      String(
        p.name || ""
      ).trim();

    // lowercased for matching only — display keeps rawName's casing
    const name =
      rawName.toLowerCase();

    const shouldIgnore =
      type.includes("waypoint") ||
      type.includes("centroid") ||
      type.includes(
        "restricted area"
      ) ||
      type.includes("beacon") ||
      name.includes("waypoint") ||
      name.includes("centroid") ||
      name.includes(
        "restricted area"
      ) ||
      name.includes("beacon");

    if (shouldIgnore) {
      continue;
    }

    if (
      !p.name &&
      !p.renderName
    ) {
      continue;
    }

    const renderName =
      String(
        p.renderName || ""
      ).trim();

    const keywords =
      Array.isArray(
        p.keywords
      )
        ? p.keywords
        : [];

    const matchedKeyword =
      keywords.find((k) =>
        String(k)
          .toLowerCase()
          .includes(q)
      );

    const matched =
      name.includes(q) ||
      renderName
        .toLowerCase()
        .includes(q) ||
      matchedKeyword;

    if (!matched) {
      continue;
    }

    const uniqueKey =
      p.landmarkId ||
      f.id ||
      name;

    if (seen.has(uniqueKey)) {
      continue;
    }

    seen.add(uniqueKey);

    const floorNo =
      p.floor ?? 0;

    let floorLabel =
      "";

    if (floorNo < 0) {
      floorLabel =
        `B${Math.abs(
          floorNo
        )}`;
    } else if (
      floorNo === 0
    ) {
      floorLabel = "G";
    } else {
      floorLabel =
        `F${floorNo}`;
    }

    results.push({
      feature: f,
      matchedText:
        matchedKeyword ||
        renderName ||
        rawName,
      actualName:
        renderName || rawName,
      floorLabel,
    });

    if (
      results.length >= 10
    ) {
      break;
    }
  }

  // OUTDOOR SEARCH
  if (results.length === 0) {
    const googlePlaces =
      await searchGoogleNearbyPlaces(
        query,
        venueCenter
      );

    googlePlaces.forEach((g) => {
      results.push({
        googlePlace: g,

        matchedText:
          g.name,

        actualName:
          g.address,

        floorLabel:
          "Outside",
      });
    });
  }

  return results.slice(0, 15);
};