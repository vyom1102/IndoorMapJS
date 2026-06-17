import { centerOfMass } from "@turf/center-of-mass";
import minimumRotatedRectangle from "@turf/bbox-polygon";
export const getPolygonCenter = (geometry) => {
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!ring?.length) return null;
 
  let points = ring;

  // Skip duplicated closing point
  if (
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    points = ring.slice(0, -1);
  }

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) continue;

    sumLng += point[0];
    sumLat += point[1];
    count += 1;
  }

  if (!count) return null;

  return [sumLng / count, sumLat / count];
};
export const getPolygonMinDimensionMeters = (geometry) => {
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!ring?.length) return 0;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    minLng = Math.min(minLng, point[0]);
    maxLng = Math.max(maxLng, point[0]);
    minLat = Math.min(minLat, point[1]);
    maxLat = Math.max(maxLat, point[1]);
  }

  if (!isFinite(minLng) || !isFinite(minLat)) return 0;

  const centerLat = (minLat + maxLat) / 2;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const widthM = Math.abs(maxLng - minLng) * metersPerDegLng;
  const heightM = Math.abs(maxLat - minLat) * metersPerDegLat;
  return Math.min(widthM, heightM);
};

export const getPolygonDimensionsMeters = (geometry) => {
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!ring?.length) return { widthM: 0, heightM: 0 };

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    minLng = Math.min(minLng, point[0]);
    maxLng = Math.max(maxLng, point[0]);
    minLat = Math.min(minLat, point[1]);
    maxLat = Math.max(maxLat, point[1]);
  }

  if (!isFinite(minLng) || !isFinite(minLat)) return { widthM: 0, heightM: 0 };

  const centerLat = (minLat + maxLat) / 2;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const widthM = Math.abs(maxLng - minLng) * metersPerDegLng;
  const heightM = Math.abs(maxLat - minLat) * metersPerDegLat;
  return { widthM, heightM };
};
export const getPolygonRotationRad = (geometry) => {
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!Array.isArray(ring) || ring.length < 3) return 0;

  let points = ring;
  if (
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    points = ring.slice(0, -1);
  }

  // Correct for longitude distortion before measuring angles.
  let sumLat = 0;
  for (const [, lat] of points) sumLat += lat;
  const centerLat = sumLat / points.length;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

  const projected = points.map(([lng, lat]) => [
    lng * metersPerDegLng,
    lat * metersPerDegLat,
  ]);

  const hull = convexHull(projected);
  if (hull.length < 3) return 0;

  let best = { area: Infinity, angle: 0, width: 0, height: 0 };

  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const edgeLen = Math.sqrt(dx * dx + dy * dy);
    if (edgeLen < 1e-9) continue;

    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of hull) {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const area = width * height;

    if (area < best.area) {
      best = { area, angle, width, height };
    }
  }

  const longSideAngle =
    best.width >= best.height ? best.angle : best.angle + Math.PI / 2;

  return -longSideAngle;
};

const convexHull = (points) => {
  const pts = [...points].sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);
  if (pts.length < 3) return pts;

  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
};
// export const getPolygonRotationRad = (geometry) => {
//   const ring =
//     geometry?.type === "Polygon"
//       ? geometry.coordinates?.[0]
//       : geometry?.type === "MultiPolygon"
//       ? geometry.coordinates?.[0]?.[0]
//       : null;

//   if (!Array.isArray(ring) || ring.length < 2) return 0;

//   // Weight each edge's angle by its length, and fold angles into a
//   // common reference mod 90° so opposite/perpendicular edges of a
//   // rectilinear room reinforce each other instead of canceling out.
//   // This is far less sensitive to a single noisy/irregular edge than
//   // just picking the single longest segment.
//   let sumSin = 0;
//   let sumCos = 0;

//   for (let i = 0; i < ring.length - 1; i += 1) {
//     const a = ring[i];
//     const b = ring[i + 1];
//     if (!Array.isArray(a) || !Array.isArray(b)) continue;

//     const dx = b[0] - a[0];
//     const dy = b[1] - a[1];
//     const len = Math.sqrt(dx * dx + dy * dy);
//     if (len < 1e-9) continue;

//     // Fold into [0, 90°) range, then quadruple the angle so that
//     // edges 90° apart (the two sides of a rectangle) map to the same
//     // point on the circle before averaging — this is the standard
//     // trick for averaging angles with 90°-periodic symmetry.
//     const angle = Math.atan2(dy, dx);
//     const folded = angle * 4;

//     sumSin += Math.sin(folded) * len;
//     sumCos += Math.cos(folded) * len;
//   }

//   if (sumSin === 0 && sumCos === 0) return 0;

//   const avgAngle = Math.atan2(sumSin, sumCos) / 4;

//   return -avgAngle;
// };
// export const getPolygonRotationRad = (geometry) => {
//   const ring =
//     geometry?.type === "Polygon"
//       ? geometry.coordinates?.[0]
//       : geometry?.type === "MultiPolygon"
//       ? geometry.coordinates?.[0]?.[0]
//       : null;

//   if (!Array.isArray(ring) || ring.length < 2) return 0;

//   let longest = 0;
//   let angleRad = 0;
//   for (let i = 0; i < ring.length - 1; i += 1) {
//     const a = ring[i];
//     const b = ring[i + 1];
//     if (!Array.isArray(a) || !Array.isArray(b)) continue;
//     const dx = b[0] - a[0];
//     const dy = b[1] - a[1];
//     const len = dx * dx + dy * dy;
//     if (len > longest) {
//       longest = len;
//       angleRad = Math.atan2(dy, dx);
//     }
//   }

//   return -angleRad;
// };

export const getFeatureTopHeight = (props = {}) => {
  const baseHeight = Number(props.baseHeight ?? 0) || 0;
  const type = String(props.type || "").toLowerCase();
  const parsedHeight = Number(props.height);
  const hasValidHeight = Number.isFinite(parsedHeight) && parsedHeight > 0;

  if (type === "wall") {
    return baseHeight + (hasValidHeight ? parsedHeight : 4);
  }

  if (type === "booth") {
    return baseHeight + 2;
  }

  if (type === "cafeteria" || type.includes("food") || type === "lift") {
    return baseHeight + (hasValidHeight ? parsedHeight : 2);
  }

  if (type === "green area" || type === "green area | pots") {
    return baseHeight + 0.2;
  }

  return baseHeight + (hasValidHeight ? parsedHeight : 0);
};

export const getFeatureBaseHeight = (props = {}) => {
  return Number(props.baseHeight ?? 0) || 0;
};

export const getFeatureAnchorCoordinates = (feature) => {
  const geometryType = feature?.geometry?.type;
  if (geometryType === "Point") return feature.geometry?.coordinates || null;
  if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
    return getPoleOfInaccessibility(feature.geometry);
  }
  return null;
};


export const getPoleOfInaccessibility = (geometry) => {
  let ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!ring?.length) return null;

  // Remove duplicated closing point
  if (
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    ring = ring.slice(0, -1);
  }

  // SIMPLE VISUAL CENTER
  let sumLng = 0;
  let sumLat = 0;

  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }

  return [
    sumLng / ring.length,
    sumLat / ring.length,
  ];
};
export const getPolygonCenterOfMass = (geometry) => {
  if (!geometry) return null;
  try {
    const result = centerOfMass({ type: "Feature", properties: {}, geometry });
    const coords = result?.geometry?.coordinates;
    return Array.isArray(coords) && coords.length >= 2 ? coords : null;
  } catch {
    return null;
  }
};