import {
  ESCALATOR_MODEL_URL,
  ESCALATOR_DOWN_MODEL_URL,
  SITTING_AREA_MODEL_URL,
} from "./constants";
import { getObjectFileUrl } from "./assetUrls";

export const isEscalatorFeature = (feature) => {
  const p = feature?.properties || {};
  const type = String(p.type || p.polygonType || "").toLowerCase();
  return type.includes("escalator");
};

export const isSittingAreaFeature = (feature) => {
  const p = feature?.properties || {};
  const type = String(p.type || p.polygonType || p.subType || "").toLowerCase();
  const name = String(p.name || "").toLowerCase();
  return (
    type.includes("sitting") ||
    type.includes("sit") ||
    type.includes("seating") ||
    type.includes("seat") ||
    type.includes("bench") ||
    type.includes("waiting") ||
    type.includes("sitting area") ||
    name.includes("sitting area") ||
    name.includes("seating") ||
    name.includes("seat") ||
    name.includes("bench") ||
    name.includes("waiting")
  );
};

export const isPolygonFeature = (feature) => {
  const type = feature?.geometry?.type;
  return type === "Polygon" || type === "MultiPolygon";
};

export const isEscalatorPolygonFeature = (feature) => {
  return isEscalatorFeature(feature) && isPolygonFeature(feature);
};

export const isSittingAreaPolygonFeature = (feature) => {
  return isSittingAreaFeature(feature) && isPolygonFeature(feature);
};

// export const getEscalatorModelUrl = (feature, pointFeature) => {
//   const p = feature?.properties || {};
//   const pp = pointFeature?.properties || {};

//   // Prefer numeric determination: if `number` (f number) is present and level is present,
//   // show down escalator when number < level.
//   // const levelVal = Number(p.level ?? p.floor ?? NaN);
//     const toNum = (v) => {
//       if (v === null || v === undefined) return NaN;
//       const s = String(v).trim();
//       if (!s) return NaN;
//       if (s.toLowerCase() === "nan") return NaN;
//       const n = Number(s);
//       return Number.isFinite(n) ? n : NaN;
//     };

//     const levelVal = toNum(p.level ?? p.floor);

//     const numberCandidates = [
//       p.number,
//       p.fNumber,
//       p.floorNumber,
//       p.floorNo,
//       pp.number,
//       pp.fNumber,
//       pp.floorNumber,
//       pp.floorNo,
//     ];
//     let numberVal = NaN;
//     for (const cand of numberCandidates) {
//       const n = toNum(cand);
//       if (!Number.isNaN(n)) {
//         numberVal = n;
//         break;
//       }
//     }
//     console.log("Determining escalator model URL with levelVal =", levelVal, "and numberVal =", numberVal);
//     if (!Number.isNaN(numberVal) && !Number.isNaN(levelVal)) {
//       return numberVal < levelVal ? ESCALATOR_DOWN_MODEL_URL : ESCALATOR_MODEL_URL;
//     }

//   // Fallback: check explicit type strings on polygon or associated point
//   const type = String(p.type || p.polygonType || "").toLowerCase();
//   const pointType = String(pp.type || pp.polygonType || "").toLowerCase();
//   if (type.includes("escalator-down") || pointType.includes("escalator-down")) {
//     return ESCALATOR_DOWN_MODEL_URL;
//   }

//   return getObjectFileUrl(p.objectFile) || ESCALATOR_MODEL_URL;
// };
export const getEscalatorModelUrl = (feature, pointFeature) => {
  const p = feature?.properties || {};

  // pointFeature may be either a full GeoJSON feature or just properties
  const pp = pointFeature?.properties ?? pointFeature ?? {};
  console.log("feature =", feature);
  console.log("pointFeature =", pointFeature);
  const toNum = (v) => {
    if (v == null) return NaN;

    const s = String(v).trim();

    if (
      s === "" ||
      s.toLowerCase() === "nan" ||
      s.toLowerCase() === "undefined" ||
      s.toLowerCase() === "null"
    ) {
      return NaN;
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  // Polygon floor
  const levelVal = toNum(p.level ?? p.floor);

  // Point floor / number
  const numberCandidates = [
    p.number,
    p.fNumber,
    p.floorNumber,
    p.floorNo,
    pp.number,
    pp.fNumber,
    pp.floorNumber,
    pp.floorNo,
  ];

  let numberVal = NaN;

  for (const candidate of numberCandidates) {
    const n = toNum(candidate);
    if (!Number.isNaN(n)) {
      numberVal = n;
      break;
    }
  }

  console.log(
    "Determining escalator model URL",
    {
      polygonLevel: levelVal,
      pointNumber: numberVal,
      polygonProps: p,
      pointProps: pp,
    }
  );

  // If point floor is below polygon floor → down escalator
  if (!Number.isNaN(levelVal) && !Number.isNaN(numberVal)) {
    return numberVal < levelVal
      ? ESCALATOR_DOWN_MODEL_URL
      : ESCALATOR_MODEL_URL;
  }

  // Fallback to explicit type names
  const type = String(p.type || p.polygonType || "").toLowerCase();
  const pointType = String(pp.type || pp.polygonType || "").toLowerCase();

  if (
    type.includes("escalator-down") ||
    pointType.includes("escalator-down")
  ) {
    return ESCALATOR_DOWN_MODEL_URL;
  }

  if (
    type.includes("escalator-up") ||
    pointType.includes("escalator-up")
  ) {
    return ESCALATOR_MODEL_URL;
  }

  return getObjectFileUrl(p.objectFile) || ESCALATOR_MODEL_URL;
};
export const getSittingAreaModelUrl = (feature) => {
  return getObjectFileUrl(feature?.properties?.objectFile) || SITTING_AREA_MODEL_URL;
};

export const isGreenAreaFeature = (feature) => {
  const type = String(
    feature.properties?.type || ""
  ).toLowerCase();

  return (
    type === "green area" ||
    type === "green area | pots"
  );
};

export const getTreeModelUrl = () => {
  return "/assets/models/tree.glb";
};
export const isParkingFeature = (feature) => {
  const p = feature?.properties || {};
  const type = String(p.type || p.polygonType || "").toLowerCase();
  return type === "parking" || type.includes("parking");
};

export const isParkingPolygonFeature = (feature) => {
  return isParkingFeature(feature) && isPolygonFeature(feature);
};

export const getCarModelUrl = () => {
  return "/assets/models/car.glb";
};

/**
 * Features flagged `hideElement` get no 2D representation at all — no icon, no
 * pill, no label, no GLB marker. Used for points that are drawn as extruded 3D
 * furniture, where a marker sitting on top of the 3D object is unwanted.
 *
 * The flag arrives as either a boolean or the string "true" depending on how
 * the property survived encoding, so both are accepted.
 */
export const isElementHidden = (feature) => {
  const value = feature?.properties?.hideElement;
  return value === true || value === "true";
};
