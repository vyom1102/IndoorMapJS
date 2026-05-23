export const getPolygonCenter = (geometry) => {
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!ring?.length) return null;

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const point of ring) {
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

  if (!Array.isArray(ring) || ring.length < 2) return 0;

  let longest = 0;
  let angleRad = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    if (len > longest) {
      longest = len;
      angleRad = Math.atan2(dy, dx);
    }
  }

  return -angleRad;
};

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
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!ring?.length) return null;

  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }

  const width = maxLng - minLng;
  const height = maxLat - minLat;
  const cellSize = Math.min(width, height) / 16;
  if (cellSize === 0) return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

  const pointInPolygon = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  };

  const pointToSegmentDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const nearX = ax + t * dx, nearY = ay + t * dy;
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
  };

  const distToPolygon = (x, y, poly) => {
    let minDist = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const d = pointToSegmentDist(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
      if (d < minDist) minDist = d;
    }
    return pointInPolygon(x, y, poly) ? minDist : -minDist;
  };

  let bestDist = -Infinity;
  let bestPoint = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

  for (let x = minLng + cellSize / 2; x < maxLng; x += cellSize) {
    for (let y = minLat + cellSize / 2; y < maxLat; y += cellSize) {
      const d = distToPolygon(x, y, ring);
      if (d > bestDist) {
        bestDist = d;
        bestPoint = [x, y];
      }
    }
  }

  return bestPoint;
};
