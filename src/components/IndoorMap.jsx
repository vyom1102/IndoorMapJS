import { useEffect, useState, useRef } from "react";
import maplibregl from "maplibre-gl";
import * as THREE from "three";

import { useMap } from "../hooks/useMap";
import { getGeojsonData } from "../services/api";
import { splitFeatures } from "../utils/splitFeatures";
import { addPatternImage } from "../utils/patterns";
import { createPillImage } from "../utils/pill";
import { fetchNearbyNodes } from "../services/FetchGraphAPI";
import { dijkstra, findClosestNode } from "../utils/RouteFunctions";
import { useParams } from "react-router-dom";
import { loadVenueData } from "../services/venueApi";

const baseUrl = import.meta.env.VITE_BASE_URL || "";
const FIXED_GLB_SIZE_PX = 80;
// Fixed pixel size (in metres equivalent) for boundary logos
const BOUNDARY_LOGO_SIZE_M = 20;

const getPolygonCenter = (geometry) => {
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

const getPolygonMinDimensionMeters = (geometry) => {
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

const getPolygonDimensionsMeters = (geometry) => {
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

const getPolygonRotationRad = (geometry) => {
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

// const getFeatureTopHeight = (props = {}) => {
//   const baseHeight = Number(props.baseHeight ?? 0) || 0;
//   const type = String(props.type || "").toLowerCase();
//   const parsedHeight = Number(props.height);
//   const hasValidHeight = Number.isFinite(parsedHeight) && parsedHeight > 0;

//   if (type === "wall") return baseHeight + (hasValidHeight ? parsedHeight : 4);
//   if (type === "booth") return baseHeight + 2;
//   if (type === "green area" || type === "green area | pots") return baseHeight + 0.2;
//   // For all other types: only add height if explicitly set, otherwise 0
//   return baseHeight + (hasValidHeight ? parsedHeight : 0);
// };
const getFeatureTopHeight = (props = {}) => {
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

  if (
    type === "cafeteria" ||
    type.includes("food") ||
    type === "lift"
  ) {
    return baseHeight + (hasValidHeight ? parsedHeight : 2);
  }

  if (
    type === "green area" ||
    type === "green area | pots"
  ) {
    return baseHeight + 0.2;
  }

  // For all other types
  return baseHeight + (hasValidHeight ? parsedHeight : 0);
};

const getFeatureAnchorCoordinates = (feature) => {
  const geometryType = feature?.geometry?.type;
  if (geometryType === "Point") return feature.geometry?.coordinates || null;
  if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
    return getPoleOfInaccessibility(feature.geometry);
  }
  return null;
};

const getPoleOfInaccessibility = (geometry) => {
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

const getObjectFileUrl = (objectFile) => {
  if (!objectFile) return null;
  if (/^https?:\/\//i.test(objectFile)) return objectFile;
  const cleanBase = String(baseUrl).replace(/\/+$/, "");
  const cleanPath = String(objectFile).replace(/^\/+/, "");
  return `${cleanBase}/uploads/${cleanPath}`;
};

const getImageFileUrl = (imageFile) => {
  if (!imageFile) return null;
  if (/^https?:\/\//i.test(imageFile)) return imageFile;
  const cleanBase = String(baseUrl).replace(/\/+$/, "");
  const cleanPath = String(imageFile).replace(/^\/+/, "");
  return `${cleanBase}/uploads/${cleanPath}`;
};

// ─── Shared helper to build + register a custom 3D plane layer ───────────────
const buildLogoPlaneLayer = (map, layerId, planes) => {
  map.addLayer({
    id: layerId,
    type: "custom",
    renderingMode: "3d",
    onAdd: function (_map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({
        canvas: _map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;
      this.mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          side: THREE.DoubleSide,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        })
      );
      this.scene.add(this.mesh);

      this.planes = planes.map(({ center, texture, scaleX, scaleY, z, rot }) => {
        const mercator = maplibregl.MercatorCoordinate.fromLngLat(
          { lng: center[0], lat: center[1] },
          z
        );
        const meterScale = mercator.meterInMercatorCoordinateUnits();
        return {
          texture,
          tx: mercator.x,
          ty: mercator.y,
          tz: mercator.z,
          sx: meterScale * scaleX,
          sy: meterScale * scaleY,
          rot: rot || 0,
        };
      });
    },
    render: function (_gl, matrix) {
      const base = new THREE.Matrix4().fromArray(matrix);
      this.renderer.state.reset();
      this.renderer.clearDepth();

      this.planes.forEach((plane) => {
        this.mesh.material.map = plane.texture;
        this.mesh.material.needsUpdate = true;

        const rotationX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          Math.PI
        );
        // const rotationZ = new THREE.Matrix4().makeRotationAxis(
        //   new THREE.Vector3(0, 0, 1),
        //   plane.rot || 0
        // );
        // current map bearing
        const mapBearingRad =
          (-map.getBearing() * Math.PI) / 180;

        // make image face camera
        // const dynamicRotation =
        //   mapBearingRad + (plane.rot || 0);

        // const rotationZ =
        //   new THREE.Matrix4().makeRotationAxis(
        //     new THREE.Vector3(0, 0, 1),
        //     dynamicRotation
        //   );
        const normalizedBearing =
  ((map.getBearing() % 360) + 360) % 360;

          const planeDeg =
            (((plane.rot || 0) * 180) / Math.PI + 360) % 360;

          // difference between camera + polygon direction
          let delta =
            normalizedBearing - planeDeg;

          delta = ((delta + 540) % 360) - 180;

          // ONLY flip when backside visible
          const shouldFlip =
            Math.abs(delta) > 90;

          const finalRotation =
            (plane.rot || 0) +
            (shouldFlip ? Math.PI : 0);

          const rotationZ =
            new THREE.Matrix4().makeRotationAxis(
              new THREE.Vector3(0, 0, 1),
              finalRotation
            );
        const modelMatrix = new THREE.Matrix4()
          .makeTranslation(plane.tx, plane.ty, plane.tz)
          .multiply(rotationZ)
          .multiply(rotationX)
          .scale(new THREE.Vector3(plane.sx, plane.sy, 1));

        this.camera.projectionMatrix = base.clone().multiply(modelMatrix);
        this.renderer.render(this.scene, this.camera);
      });

      map.triggerRepaint();
    },
    onRemove: function () {
      this.mesh?.geometry?.dispose?.();
      this.mesh?.material?.dispose?.();
      this.renderer?.dispose?.();
    },
  });
};

// ─── Shared scale helper (aspect-correct fit inside polygon footprint) ────────
const computePlaneScale = (widthM, heightM, aspect, coverFraction = 0.65) => {
  const maxWidth  = Math.max(0.3, widthM  * coverFraction);
  const maxHeight = Math.max(0.3, heightM * coverFraction);
  let scaleX, scaleY;
  if (maxWidth / aspect <= maxHeight) {
    scaleX = maxWidth;
    scaleY = maxWidth / aspect;
  } else {
    scaleY = maxHeight;
    scaleX = maxHeight * aspect;
  }
  return {
    scaleX: Math.min(scaleX, maxWidth),
    scaleY: Math.min(scaleY, maxHeight),
  };
};

// ─── Fixed-size plane scale (for boundary logos — constant physical metres) ──
const computeFixedPlaneScale = (aspect, sizeM = BOUNDARY_LOGO_SIZE_M) => {
  if (aspect >= 1) {
    return { scaleX: sizeM, scaleY: sizeM / aspect };
  }
  return { scaleX: sizeM * aspect, scaleY: sizeM };
};

export default function IndoorMap() {
  const { mapRef, containerRef, ready } = useMap();

  const [geo, setGeo] = useState(null);
  const [floor, setFloor] = useState(0);
  const [venueData, setVenueData] = useState(null);
  const markersRef = useRef([]);
  const sourceRef = useRef(null);
  const destRef = useRef(null);
  const customLayerIdsRef = useRef([]);
  const routePathRef = useRef([]);
  const graphRef = useRef(null);
  
  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [sourceResults, setSourceResults] = useState([]);
  const [destResults, setDestResults] = useState([]);

  const venueName = "DelhiMetro"; // PIECC
  const defaultCenter = venueData
    ? [venueData.lng, venueData.lat]
    : [77.2437, 28.6063];

  useEffect(() => {
    if (!venueName) return;
    const loadVenue = async () => {
      const data = await loadVenueData(venueName);
      if (!data) return;
      setVenueData(data);
      const map = mapRef.current;
      if (map) {
        map.flyTo({ center: [data.lng, data.lat], zoom: 18 });
      }
      setFloor(data.floors?.[0] || 0);
    };
    loadVenue();
  }, [venueName]);

  useEffect(() => {
    getGeojsonData(venueName).then((res) => {
      if (!res?.data) return;
      setGeo({
        type: "FeatureCollection",
        features: res.data.data || res.data.features || [],
      });
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
// FLOOR CLEANUP + SWITCH RENDER
// ─────────────────────────────────────────────────────────────

const cleanupFloor = (targetFloor) => {
  const map = mapRef.current;
  if (!map) return;

  // remove markers
  markersRef.current.forEach((m) => {
    try {
      m.remove();
    } catch {}
  });

  markersRef.current = [];

  // remove custom 3d layers
  customLayerIdsRef.current.forEach((id) => {
    try {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    } catch {}
  });

  customLayerIdsRef.current = [];

  // remove all generated layers
  const styleLayers = map.getStyle()?.layers || [];

  styleLayers.forEach((layer) => {
    const id = layer.id;

    if (
      id.includes(`-${targetFloor}`) ||
      id.includes(`_${targetFloor}_`) ||
      id.startsWith("animal") ||
      id.startsWith("route") ||
      id.startsWith("boundary") ||
      id.startsWith("section") ||
      id.startsWith("subsection") ||
      id.startsWith("sponsor") ||
      id.startsWith("exhibitor") ||
      id.startsWith("point-image") ||
      id.startsWith("default-poi")
    ) {
      try {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      } catch {}
    }
  });

  // remove sources
  const styleSources = map.getStyle()?.sources || {};

  Object.keys(styleSources).forEach((id) => {
    if (
      id.includes(`-${targetFloor}`) ||
      id.includes(`_${targetFloor}_`) ||
      id.startsWith("animal") ||
      id.startsWith("route") ||
      id.startsWith("boundary") ||
      id.startsWith("section") ||
      id.startsWith("subsection") ||
      id.startsWith("sponsor") ||
      id.startsWith("exhibitor") ||
      id.startsWith("point-image") ||
      id.startsWith("default-poi")
    ) {
      try {
        if (map.getSource(id)) {
          map.removeSource(id);
        }
      } catch {}
    }
  });
};

// ─────────────────────────────────────────────────────────────
// FLOOR SWITCH FUNCTION
// ─────────────────────────────────────────────────────────────

const switchFloor = async (newFloor) => {
  if (newFloor === floor) return;

  // remove previous floor render
  cleanupFloor(floor);

  // update floor state
  setFloor(newFloor);

  // wait next frame so react updates
  requestAnimationFrame(() => {
    // re-render route for floor
    if (routePathRef.current?.length) {
      renderRouteForFloor(
        routePathRef.current,
        newFloor
      );
    }
  });
};
  // 🧱 Rendering Logic
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo || !ready) return;

    const render = async () => {
  // ── Remove ALL custom 3D layers across every known floor ──────────────
  const allFloors = venueData?.floors || [floor];
  const customLayerPrefixes = [
    "boundary-logo-3d-",
    "sponsor-logo-3d-",
    "exhibitor-logo-3d-",
    "point-image-3d-",
  ];
  allFloors.forEach((f) => {
    customLayerPrefixes.forEach((prefix) => {
      const id = `${prefix}${f}`;
      if (map.getLayer(id)) map.removeLayer(id);
    });
  });
  // Also clear any tracked from previous renders
  customLayerIdsRef.current.forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  customLayerIdsRef.current = [];

  // ── Helper to build + track custom 3D layers ──────────────────────────
  const addTrackedLogoLayer = (layerId, planes) => {
    buildLogoPlaneLayer(map, layerId, planes);
    customLayerIdsRef.current.push(layerId);
  };

  const floorFeatures = geo.features.filter(
    (f) => (f.properties?.floor ?? 0) === floor
  );

  const { rooms, boundaries, animals, sections, sponsorPoints, exhibitorPoints } =
    splitFeatures(floorFeatures);

  const topSections = sections.filter(
    (f) => !f.properties?.subSection && f.properties?.type !== "Sub Section"
  );
  const subSections = sections.filter(
    (f) => f.properties?.subSection || f.properties?.type === "Sub Section"
  );


// ── GENERAL LANDMARK IMAGE/TEXT PLANES ────────────────────────────────

// include ALL point landmarks
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

const createTextTexture = async (text) => {
  return await new Promise((resolve) => {
    const canvas = document.createElement("canvas");

    canvas.width = 1024;
    canvas.height = 512;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const safeText = String(text || "").trim();

    // ── MULTILINE SPLIT ───────────────────────────────
    const words = safeText.split(" ");

    let lines = [];

    if (words.length <= 1) {
      lines = [safeText];
    } else {
      const mid = Math.ceil(words.length / 2);

      lines = [
        words.slice(0, mid).join(" "),
        words.slice(mid).join(" "),
      ];
    }

    // ── FIND BEST FONT SIZE ──────────────────────────
    let fontSize = 170;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    while (fontSize > 40) {
      ctx.font = `700 ${fontSize}px sans-serif`;

      const widest = Math.max(
        ...lines.map((l) =>
          ctx.measureText(l).width
        )
      );

      if (widest < canvas.width * 0.82) {
        break;
      }

      fontSize -= 8;
    }

    // ── TEXT STYLE ────────────────────────────────────
    ctx.font = `700 ${fontSize}px sans-serif`;

    ctx.fillStyle = "#000000";

    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 10;

    const lineHeight = fontSize * 1.05;

    // PERFECT CENTERING
    const totalHeight =
      (lines.length - 1) * lineHeight;

    const startY =
      canvas.height / 2 - totalHeight / 2;

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        canvas.width / 2,
        startY + index * lineHeight
      );
    });

    const texture =
      new THREE.CanvasTexture(canvas);

    texture.needsUpdate = true;

    resolve(texture);
  });
};

  // 🔥 Remove old markers
  markersRef.current.forEach((m) => m.remove());
  markersRef.current = [];

  // 🔥 Clean standard layers
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
      l.id.startsWith("subsection-")
    ) {
      if (map.getLayer(l.id)) map.removeLayer(l.id);
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
      id.startsWith("subsection-")
    ) {
      if (map.getSource(id)) map.removeSource(id);
    }
  });

  // ── 1. BOUNDARY BASE ──────────────────────────────────────────────────
  map.addSource(`boundary-base-src-${floor}`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: boundaries },
  });
  map.addLayer({
    id: `boundary-base-${floor}`,
    type: "fill",
    source: `boundary-base-src-${floor}`,
    paint: { "fill-color": "#D4DBDD", "fill-opacity": 1 },
  });

  // ── 2. ROOMS (3D) ─────────────────────────────────────────────────────
  map.addSource(`floor_${floor}_rooms`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: rooms },
  });
  map.addLayer({
    id: `floor_${floor}_rooms`,
    type: "fill-extrusion",
    source: `floor_${floor}_rooms`,
    minzoom: 16,
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
      "fill-extrusion-height": [
        "case",
        ["==", ["downcase", ["get", "type"]], "wall"],
        ["+",
          ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
          ["case",
            ["all", ["has", "height"], ["!=", ["get", "height"], "undefined"], [">", ["to-number", ["get", "height"]], 0]],
            ["to-number", ["get", "height"]],
            4
          ]
        ],
        ["==", ["get", "type"], "Booth"],
        ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 2],
        [
          "any",
          ["==", ["downcase", ["get", "type"]], "lift"],
          ["in", ["downcase", ["get", "type"]], ["literal", ["cafeteria", "piller","counter","security check","male washroom","female washroom","unisex washroom","drinking water","accessible washroom"]]],
        ],
        ["+",
          ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
          ["case",
            ["all", ["has", "height"], ["!=", ["get", "height"], "undefined"], [">", ["to-number", ["get", "height"]], 0]],
            ["to-number", ["get", "height"]],
            2
          ]
        ],
        ["in", ["downcase", ["get", "type"]], ["literal", ["green area", "green area | pots"]]],
        ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 0.2],
        ["all", ["has", "height"], ["!=", ["get", "height"], "undefined"], [">", ["to-number", ["get", "height"]], 0]],
        ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
      ],
      "fill-extrusion-base": [
        "case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0,
      ],
      "fill-extrusion-opacity": 1,
    },
  });

  // ── 3. SECTIONS (3D) ──────────────────────────────────────────────────
  map.addSource(`section-src-${floor}`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: topSections },
  });
  map.addLayer({
    id: `floor_${floor}_sections`,
    type: "fill-extrusion",
    source: `section-src-${floor}`,
    minzoom: 16,
    maxzoom: 17,
    paint: {
      "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#ccc"],
      "fill-extrusion-height": [
        "case",
        ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
        ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 4],
      ],
      "fill-extrusion-base": [
        "case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0,
      ],
      "fill-extrusion-opacity": 1,
    },
  });

  // ── 4. SUBSECTIONS (3D) ───────────────────────────────────────────────
  map.addSource(`subsection-src-${floor}`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: subSections },
  });
  map.addLayer({
    id: `floor_${floor}_subsections`,
    type: "fill-extrusion",
    source: `subsection-src-${floor}`,
    minzoom: 17,
    maxzoom: 18,
    paint: {
      "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#aaa"],
      "fill-extrusion-height": [
        "case",
        ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
        ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 4],
      ],
      "fill-extrusion-base": [
        "case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0,
      ],
      "fill-extrusion-opacity": 1,
    },
  });

  // 🎨 PATTERNS
  rooms.forEach((f, i) => {
    if (!f.properties?.pattern) return;
    const pat = addPatternImage(map, f.properties);
    const src = `pattern_${floor}_${i}`;
    map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [f] } });
    map.addLayer({ id: src, type: "fill", source: src, paint: { "fill-pattern": pat } });
  });

  // ── 5. BOUNDARY LABEL LAYER — zoom 15–16 ─────────────────────────────
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

  map.addSource(`boundary-label-src-${floor}`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: boundaryLabelFeatures },
  });
  map.addLayer({
    id: `boundary-label-${floor}`,
    type: "symbol",
    source: `boundary-label-src-${floor}`,
    minzoom: 15,
    maxzoom: 16,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 14,
      "text-anchor": "center",
      "text-offset": [0, 1.5],
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#222",
      "text-halo-color": "#fff",
      "text-halo-width": 1.5,
    },
  });

  const sectionImageByPolygon = new Map();
  const subSectionImageByPolygon = new Map();
  const sectionCentroidByPolygon = new Map();
  const subSectionCentroidByPolygon = new Map();

  for (const f of floorFeatures) {
    const p = f.properties || {};
    if (f.geometry?.type !== "Point") continue;
    if (!Array.isArray(p.associatedPolygons)) continue;

    const isSection =
      p.type === "Section" &&
      !p.subSection &&
      p.polygonType !== "Sub Section";
    const isSubSection =
      p.type === "Sub Section" ||
      p.subSection === true ||
      p.polygonType === "Sub Section";

    const centroid =
      p.centroid ||
      (f.geometry?.type === "Point" ? f.geometry.coordinates : null);

    for (const polyId of p.associatedPolygons) {
      const key = String(polyId);
      if (isSection) {
        if (p.imageFile) sectionImageByPolygon.set(key, p.imageFile);
        if (centroid) sectionCentroidByPolygon.set(key, centroid);
      } else if (isSubSection) {
        if (p.imageFile) subSectionImageByPolygon.set(key, p.imageFile);
        if (centroid) subSectionCentroidByPolygon.set(key, centroid);
      } else {
        if (p.imageFile && !sectionImageByPolygon.has(key))
          sectionImageByPolygon.set(key, p.imageFile);
        if (centroid && !sectionCentroidByPolygon.has(key))
          sectionCentroidByPolygon.set(key, centroid);
      }
    }
  }

  const centroidFeaturesByLandmark = new Map();
  for (const f of floorFeatures) {
    const p = f.properties || {};
    if (p.type !== "Centroid") continue;
    const keys = [p.landmarkId, f.id, f._id, p.id, p._id].filter(Boolean);
    keys.forEach((k) => centroidFeaturesByLandmark.set(String(k), f));
  }

    // ── DEFAULT SERVICE ICONS + LABELS ───────────────────────────────────
  const defaultPoiFeatures = [];

  // Local asset icons
  const defaultIcons = {
    cafeteria: "/assets/icons/cafeteria.png",
    lift: "/assets/icons/lift.png",
    maleWashroom: "/assets/icons/maleWashroom.png",
    femaleWashroom: "/assets/icons/femaleWashroom.png",
    unisexWashroom: "/assets/icons/unisex_washroom.png",
    stairs: "/assets/icons/stairs.png",
    water: "/assets/icons/water.png",
    reception: "/assets/icons/reception.png",
  };

  const ensureDefaultIcon = async (iconId, imagePath) => {
    if (map.hasImage(iconId)) return;

    await new Promise((resolve) => {
      map.loadImage(imagePath, (err, image) => {
        if (!err && image && !map.hasImage(iconId)) {
          map.addImage(iconId, image);
        }
        resolve();
      });
    });
  };

  // preload icons
  await Promise.all([
    ensureDefaultIcon("cafeteria-default", defaultIcons.cafeteria),
    ensureDefaultIcon("lift-default", defaultIcons.lift),
    ensureDefaultIcon("male-washroom-default", defaultIcons.maleWashroom),
    ensureDefaultIcon("female-washroom-default", defaultIcons.femaleWashroom),
    ensureDefaultIcon("unisex-washroom-default", defaultIcons.unisexWashroom),
    ensureDefaultIcon("stairs-default", defaultIcons.stairs),
    ensureDefaultIcon("water-default", defaultIcons.water),
    ensureDefaultIcon("reception-default", defaultIcons.reception),
  ]);

for (const feature of floorFeatures) {
  const p = feature.properties || {};

  const type = String(
    p.type ||
    p.polygonType ||
    p.subType ||
    ""
  ).toLowerCase();

  const polygonType = String(
    p.polygonType || ""
  ).toLowerCase();

  const name = String(p.name || "").toLowerCase();

  const hasCustomImage =
    p.imageFile ||
    p.logo ||
    p.logoUrl;

  let icon = null;
  let label = "";

  // ── CAFETERIA ─────────────────────────────────────────────
 if (
    type.includes("lift") ||
    polygonType.includes("lift")
  ) {
    icon = "lift-default";

    // NO LABEL
    label = "";
  }
  else if (
    type.includes("female washroom") ||
    polygonType.includes("female washroom") ||
    (type.includes("washroom") && name.includes("female"))
  ) {
    icon = "female-washroom-default";

    // NO LABEL
    label = "";
  }
  // ── MALE WASHROOM ────────────────────────────────────────
  else if (
    type.includes("male washroom") ||
    polygonType.includes("male washroom") ||
    (type.includes("washroom") && name.includes("male"))
  ) {
    icon = "male-washroom-default";

    // NO LABEL
    label = "";
  }

  // ── FEMALE WASHROOM ──────────────────────────────────────


  // ── UNISEX / ACCESSIBLE WASHROOM ────────────────────────
  else if (
    type.includes("unisex washroom") ||
    type.includes("accessible washroom") ||
    polygonType.includes("unisex washroom") ||
    polygonType.includes("accessible washroom")
  ) {
    icon = "unisex-washroom-default";

    // NO LABEL
    label = "";
  }

  // ── DRINKING WATER ───────────────────────────────────────
  else if (
    type.includes("drinking water") ||
    polygonType.includes("drinking water")
  ) {
    icon = "water-default";
    label = "Water";
  }

  // ── RECEPTION ────────────────────────────────────────────
  else if (
    type.includes("reception") ||
    polygonType.includes("reception")
  ) {
    icon = "reception-default";
    label = "Reception";
  }
    else if (
    type.includes("counter") ||
    polygonType.includes("counter")
  ) {
    icon = "reception-default";
    label = name || "Counter";
  }

  if (!icon) continue;

  const center =
    p.centroid ||
    getPoleOfInaccessibility(feature.geometry) ||
    getPolygonCenter(feature.geometry);

  if (!center) continue;

  defaultPoiFeatures.push({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: center,
    },
    properties: {
      icon,
      name: label,
    },
  });
}
  if (defaultPoiFeatures.length) {
    map.addSource(`default-poi-src-${floor}`, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: defaultPoiFeatures,
      },
    });

    map.addLayer({
      id: `default-poi-layer-${floor}`,
      type: "symbol",
      source: `default-poi-src-${floor}`,
      minzoom: 17,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": 0.06,
        "icon-anchor": "center",

        "text-field": ["get", "name"],
        "text-size": 12,
        "text-anchor": "top",
        // "text-offset": [0, 1],

        "text-allow-overlap": true,
        "icon-allow-overlap": true,
        "text-ignore-placement": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "text-color": "#111",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });
  }
  // ── 6. SECTION LABEL + LOGO (symbol layer, zoom 16–17) ───────────────
  const sectionSymbolFeatures = [];

  for (const section of topSections) {
    const p = section.properties || {};
    const sectionId = String(section.id || section._id || p.id || p._id || "");

    const centroidCoords =
      sectionCentroidByPolygon.get(sectionId) || p.centroid || null;

    const center =
      (Array.isArray(centroidCoords) ? centroidCoords : null) ||
      getPoleOfInaccessibility(section.geometry) ||
      getPolygonCenter(section.geometry);

    if (!center || !p.name) continue;

    const rawImageFile =
      p.imageFile || p.logo || p.logoUrl ||
      sectionImageByPolygon.get(sectionId) || "";

    const logoUrl = getImageFileUrl(rawImageFile);
    let iconId = null;

    if (logoUrl) {
      iconId = `section-icon-${logoUrl.split("/").pop().split("?")[0]}`;
      if (!map.hasImage(iconId)) {
        await new Promise((resolve) => {
          map.loadImage(logoUrl, (err, image) => {
            if (!err && image && !map.hasImage(iconId)) {
              map.addImage(iconId, image);
            }
            resolve();
          });
        });
      }
    }

    sectionSymbolFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: center },
      properties: { name: p.name, icon: iconId || "" },
    });
  }

  map.addSource(`section-label-src-${floor}`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: sectionSymbolFeatures },
  });
  map.addLayer({
    id: `section-label-${floor}`,
    type: "symbol",
    source: `section-label-src-${floor}`,
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
    paint: {
      "text-color": "#333",
      "text-halo-color": "#fff",
      "text-halo-width": 1.5,
    },
  });

  // 🐘 ANIMALS
  const features = [];
  for (const f of animals) {
    const p = f.properties || {};
    const coords = p.centroid || f.geometry.coordinates;
    const model = p.animalRef?.model_3d;
    const iconUrl = p.animalRef?.icon;

    if (model) {
      const el = document.createElement("div");
      el.innerHTML = `
        <model-viewer
          src="${model}"
          autoplay
          interaction-prompt="none"
          style="width:${FIXED_GLB_SIZE_PX}px;height:${FIXED_GLB_SIZE_PX}px;pointer-events:none;"
        ></model-viewer>
      `;
      const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);
      markersRef.current.push(marker);
      continue;
    }

    const iconId = iconUrl ? `animal_${iconUrl.split("/").pop()}` : "default";
    if (iconUrl && !map.hasImage(iconId)) {
      new Promise((resolve, reject) => {
        map.loadImage(iconUrl, (err, image) => {
          if (err) return reject(err);
          if (!map.hasImage(iconId)) map.addImage(iconId, image);
          resolve();
        });
      });
    }

    const pillId = createPillImage(map, p.name || "Animal");
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: { icon: iconId, pill: pillId },
    });
  }

  // 🗿 LANDMARK GLB OBJECTS
  for (const feature of floorFeatures) {
    const p = feature.properties || {};
    if (!p.objectFile) continue;
    if (p.animalRef?.model_3d) continue;
    const modelUrl = getObjectFileUrl(p.objectFile);
    const coords = p.centroid || getFeatureAnchorCoordinates(feature);
    if (!modelUrl || !coords) continue;
    const el = document.createElement("div");
    el.innerHTML = `
      <model-viewer
        src="${modelUrl}"
        autoplay
        interaction-prompt="none"
        style="width:${FIXED_GLB_SIZE_PX}px;height:${FIXED_GLB_SIZE_PX}px;pointer-events:none;"
      ></model-viewer>
    `;
    const marker = new maplibregl.Marker({
      element: el,
      anchor: "center",
      pitchAlignment: "viewport",
      rotationAlignment: "viewport",
    }).setLngLat(coords).addTo(map);
    markersRef.current.push(marker);
  }

  // 🔥 Animal source + layers
  map.addSource("animal-source", {
    type: "geojson",
    data: { type: "FeatureCollection", features },
  });
  map.addLayer({
    id: "animal-icon",
    type: "symbol",
    source: "animal-source",
    layout: {
      "icon-image": ["get", "icon"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.08, 15, 0.18, 17, 0.32, 19, 0.45, 21, 0.6],
      "icon-anchor": "bottom",
    },
  });
  map.addLayer({
    id: "animal-pill",
    type: "symbol",
    source: "animal-source",
    minzoom: 17,
    layout: {
      "icon-image": ["get", "pill"],
      "icon-size": 0.5,
      "icon-anchor": "top",
      "icon-offset": [0, 20],
    },
  });

  // ─── Shared state for all logo/image plane rendering ──────────────────
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin("anonymous");
  const textureCache = new Map();

  const polygonLookup = new Map();
  for (const feature of floorFeatures) {
    const geometryType = feature.geometry?.type;
    if (geometryType !== "Polygon" && geometryType !== "MultiPolygon") continue;
    const keys = [
      feature.id, feature._id,
      feature.properties?.id, feature.properties?._id,
    ].filter(Boolean);
    keys.forEach((key) => polygonLookup.set(String(key), feature));
  }

  [...boundaries, ...topSections, ...subSections].forEach((feature) => {
    const keys = [
      feature.id, feature._id,
      feature.properties?.id, feature.properties?._id,
    ].filter(Boolean);
    keys.forEach((key) => polygonLookup.set(String(key), feature));
  });

  const loadTexture = async (url) => {
    if (textureCache.has(url)) return textureCache.get(url);
    try {
      const tex = await textureLoader.loadAsync(url);
      textureCache.set(url, tex);
      return tex;
    } catch {
      textureCache.set(url, null);
      return null;
    }
  };

  const buildPlanesForPolygons = async (logoUrl, polygonIds, coverFraction = 0.65) => {
    const planes = [];
    const texture = await loadTexture(logoUrl);
    if (!texture) return planes;

    const aspect =
      texture?.image?.width && texture?.image?.height
        ? texture.image.width / texture.image.height
        : 1;

    for (const polyId of polygonIds) {
      const linkedPolygon = polygonLookup.get(polyId);
      if (!linkedPolygon) continue;

      const center = getPoleOfInaccessibility(linkedPolygon.geometry);
      if (!center) continue;

      const { widthM, heightM } = getPolygonDimensionsMeters(linkedPolygon.geometry);
      const roofZ = getFeatureTopHeight(linkedPolygon.properties) + 0.06;
      const { scaleX, scaleY } = computePlaneScale(widthM, heightM, aspect, coverFraction);

      planes.push({
        center,
        texture,
        scaleX,
        scaleY,
        z: roofZ,
        rot: getPolygonRotationRad(linkedPolygon.geometry),
      });
    }
    return planes;
  };

  // ── BOUNDARY LOGOS (THREE.js plane, zoom 15–16) ───────────────────────
  const boundaryLogoPlanes = [];

  for (const boundary of boundaries) {
    const p = boundary.properties || {};
    const logoUrl = getImageFileUrl(p.imageFile || p.logo || p.logoUrl);
    if (!logoUrl) continue;

    const center = getPoleOfInaccessibility(boundary.geometry) || getPolygonCenter(boundary.geometry);
    if (!center) continue;

    const texture = await loadTexture(logoUrl);
    if (!texture) continue;

    const aspect =
      texture?.image?.width && texture?.image?.height
        ? texture.image.width / texture.image.height
        : 1;

    const { scaleX, scaleY } = computeFixedPlaneScale(aspect, BOUNDARY_LOGO_SIZE_M);
    const roofZ = getFeatureTopHeight(p) + 0.06;

    boundaryLogoPlanes.push({
      center,
      texture,
      scaleX,
      scaleY,
      z: roofZ,
      rot: getPolygonRotationRad(boundary.geometry),
    });
  }

  if (boundaryLogoPlanes.length) {
    const boundaryLogoLayerId = `boundary-logo-3d-${floor}`;
    addTrackedLogoLayer(boundaryLogoLayerId, boundaryLogoPlanes);

    const updateBoundaryLogoVisibility = () => {
      const z = map.getZoom();
      const visible = z >= 15 && z < 16;
      if (map.getLayer(boundaryLogoLayerId)) {
        map.setLayoutProperty(
          boundaryLogoLayerId,
          "visibility",
          visible ? "visible" : "none"
        );
      }
    };
    updateBoundaryLogoVisibility();
    map.on("zoom", updateBoundaryLogoVisibility);
  }

  // ── SPONSOR LOGOS ─────────────────────────────────────────────────────
  const sponsorLogoPlanes = [];
  const sponsorNameFeatures = [];

  for (const pointFeature of sponsorPoints) {
    const p = pointFeature.properties || {};
    const logo = p.sponsorRef?.logo_url;
    if (!logo) continue;

    const polygonIds = [
      ...(p.associatedPolygons || []),
      ...(pointFeature.associatedPolygons || []),
    ].map(String);

    const sponsorName = p.name || p.sponsorRef?.name || "";
    let labelPlaced = false;

    const planes = await buildPlanesForPolygons(logo, polygonIds, 0.65);
    sponsorLogoPlanes.push(...planes);

    if (planes.length && !labelPlaced && sponsorName) {
      const first = planes[0];
      sponsorNameFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [first.center[0], first.center[1], first.z] },
        properties: { name: sponsorName },
      });
      labelPlaced = true;
    }

    if (!labelPlaced && sponsorName) {
      const fallbackCoords = p.centroid || pointFeature.geometry?.coordinates;
      if (fallbackCoords) {
        sponsorNameFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [fallbackCoords[0], fallbackCoords[1], 3] },
          properties: { name: sponsorName },
        });
      }
    }
  }

  if (sponsorLogoPlanes.length) {
    addTrackedLogoLayer(`sponsor-logo-3d-${floor}`, sponsorLogoPlanes);
  }

  // ── EXHIBITOR LOGOS ───────────────────────────────────────────────────
  const exhibitorLogoPlanes = [];

  for (const pointFeature of exhibitorPoints) {
    const p = pointFeature.properties || {};
    const logo = p.exhibitorRef?.brandingDetails?.companyLogo;
    if (!logo) continue;

    const polygonIds = [
      ...(p.associatedPolygons || []),
      ...(pointFeature.associatedPolygons || []),
    ].map(String);

    const planes = await buildPlanesForPolygons(logo, polygonIds, 0.65);
    exhibitorLogoPlanes.push(...planes);
  }

  if (exhibitorLogoPlanes.length) {
    addTrackedLogoLayer(`exhibitor-logo-3d-${floor}`, exhibitorLogoPlanes);
  }

  // ── GENERAL POINT IMAGE PLANES ────────────────────────────────────────
  // const pointImagePlanes = [];

  // for (const pointFeature of imagedPoints) {
  //   const p = pointFeature.properties || {};
  //   const imageUrl = getImageFileUrl(p.imageFile);
  //   if (!imageUrl) continue;

  //   const polygonIds = [
  //     ...(p.associatedPolygons || []),
  //     ...(pointFeature.associatedPolygons || []),
  //   ].map(String);

  //   if (polygonIds.length > 0) {
  //     const planes = await buildPlanesForPolygons(imageUrl, polygonIds, 0.65);
  //     pointImagePlanes.push(...planes);
  //     continue;
  //   }

  //   const fallbackCoords = p.centroid || pointFeature.geometry?.coordinates;
  //   if (!fallbackCoords) continue;

  //   const texture = await loadTexture(imageUrl);
  //   if (!texture) continue;

  //   const aspect =
  //     texture?.image?.width && texture?.image?.height
  //       ? texture.image.width / texture.image.height
  //       : 1;

  //   const defaultSize = 1.5;
  //   pointImagePlanes.push({
  //     center: fallbackCoords,
  //     texture,
  //     scaleX: defaultSize * aspect,
  //     scaleY: defaultSize,
  //     z: 3.06,
  //     rot: 0,
  //   });
  // }

  // if (pointImagePlanes.length) {
  //   addTrackedLogoLayer(`point-image-3d-${floor}`, pointImagePlanes);
  // }
  const pointImagePlanes = [];

for (const pointFeature of imagedPoints) {
  const p = pointFeature.properties || {};

  const type = String(
    p.type ||
    p.polygonType ||
    ""
  ).toLowerCase();

  // only cafeteria flow
  if (!type.includes("cafeteria")) continue;

  const polygonIds = [
    ...(p.associatedPolygons || []),
    ...(pointFeature.associatedPolygons || []),
  ].map(String);

  if (!polygonIds.length) continue;

  let texture = null;

  // ── IMAGE FLOW ─────────────────────────────────────
  const imageUrl = getImageFileUrl(p.imageFile);

  if (imageUrl) {
    texture = await loadTexture(imageUrl);
  }

  // ── TEXT FLOW ──────────────────────────────────────
  if (!texture) {
    texture = await createTextTexture(
      p.name || "Cafeteria"
    );
  }

  if (!texture) continue;

  const aspect =
    texture?.image?.width &&
    texture?.image?.height
      ? texture.image.width / texture.image.height
      : 2;

  for (const polyId of polygonIds) {
    const linkedPolygon =
      polygonLookup.get(polyId);

    if (!linkedPolygon) continue;

    const center =
      getPoleOfInaccessibility(
        linkedPolygon.geometry
      ) ||
      getPolygonCenter(
        linkedPolygon.geometry
      );

    if (!center) continue;

    const {
      widthM,
      heightM,
    } = getPolygonDimensionsMeters(
      linkedPolygon.geometry
    );

    const roofZ =
      getFeatureTopHeight(
        linkedPolygon.properties
      ) + 0.06;

    const {
      scaleX,
      scaleY,
    } = computePlaneScale(
      widthM,
      heightM,
      aspect,
      0.7
    );

    pointImagePlanes.push({
      center,
      texture,
      scaleX,
      scaleY,
      z: roofZ,
      rot: getPolygonRotationRad(
        linkedPolygon.geometry
      ),
    });
  }
}

if (pointImagePlanes.length) {
  addTrackedLogoLayer(
    `point-image-3d-${floor}`,
    pointImagePlanes
  );
}
    };

    if (!map.isStyleLoaded()) {
      map.once("load", render);
    } else {
      render();
    }
  }, [geo, floor, ready]);

  // 🖱️ Click handler
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
      ) return;
      const coords =
        features[0].geometry?.coordinates?.[0]?.[0] ||
        features[0].geometry?.coordinates;
      if (!coords) return;
      map.flyTo({ center: coords, zoom: 20 });
    };

    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [ready]);



  // const handleRouting = async () => {
  //     if (!sourceRef.current || !destRef.current) return;

  //   const map = mapRef.current;
  //   const src = sourceRef.current.getLngLat();
  //   const dest = destRef.current.getLngLat();
  //   console.log("SRC:", src);
  //   console.log("DEST:", dest);

  //   const graph = await fetchNearbyNodes(src.lat, src.lng);
  //   console.log("GRAPH:", graph);
  //   if (!graph) return;

  //   const start = findClosestNode(graph, src);
  //   const end = findClosestNode(graph, dest);
  //   console.log("START:", start);
  //   console.log("END:", end);

  //   const path = dijkstra(graph, start.key, end.key);
  //   console.log("PATH:", path);

  //   const coords = path.map((k) => {
  //     const [lng, lat] = k.split(",");
  //     return [parseFloat(lng), parseFloat(lat)];
  //   });

  //   const routeGeo = {
  //     type: "Feature",
  //     geometry: { type: "LineString", coordinates: coords },
  //   };

  //   if (map.getSource("route")) {
  //     map.getSource("route").setData(routeGeo);
  //   } else {
  //     map.addSource("route", { type: "geojson", data: routeGeo });
  //     map.addLayer({
  //       id: "route-line",
  //       type: "line",
  //       source: "route",
  //       paint: { "line-color": "#007AFF", "line-width": 5 },
  //     });
  //   }
  // };

  const renderRouteForFloor = (pathCoords, targetFloor) => {
  const map = mapRef.current;

  if (!map || !pathCoords?.length) return;

  const currentFloorCoords = pathCoords
    .filter((p) => p.floor === targetFloor)
    .map((p) => p.coord);

  // remove old route if no coords on floor
  if (!currentFloorCoords.length) {
    if (map.getLayer("route-line")) {
      map.removeLayer("route-line");
    }

    if (map.getSource("route")) {
      map.removeSource("route");
    }

    return;
  }

  const routeGeo = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: currentFloorCoords,
    },
  };

  if (map.getSource("route")) {
    map.getSource("route").setData(routeGeo);
  } else {
    map.addSource("route", {
      type: "geojson",
      data: routeGeo,
    });

    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#007AFF",
        "line-width": 5,
      },
    });
  }
};
  const handleRouting = async () => {
  if (!sourceRef.current || !destRef.current) return;

  const map = mapRef.current;

  const src = sourceRef.current.getLngLat();
  const dest = destRef.current.getLngLat();

  console.log("SRC:", src);
  console.log("DEST:", dest);

  const graph = await fetchNearbyNodes(
    src.lat,
    src.lng
  );

  console.log("GRAPH:", graph);

  if (!graph) return;

  // IMPORTANT:
  // attach floor to source & destination
  const srcPoint = {
    lng: src.lng,
    lat: src.lat,
    floor: src.floor, // current selected floor
  };

  const destPoint = {
    lng: dest.lng,
    lat: dest.lat,
    floor: dest.floor, // change if destination has separate floor
  };

  // optional preferences
  const selectedNodes = [];
  const unselectedNodes = [];

  const liftNodes = [];
  const stairsNodes = [];
  const escalatorNodes = [];
  const rampNodes = [];

  const start = findClosestNode(
    graph,
    srcPoint
  );

  const end = findClosestNode(
    graph,
    destPoint
  );

  console.log("START:", start);
  console.log("END:", end);

  if (!start || !end) {
    console.log("No valid start/end node");
    return;
  }

  const path = dijkstra(
    graph,
    start.key,
    end.key,
    "3d",
    selectedNodes,
    unselectedNodes,
    liftNodes,
    stairsNodes,
    escalatorNodes,
    rampNodes
  );

  console.log("PATH:", path);

  if (!path || !path.length) {
    console.log("No path found");
    return;
  }

  const coords = path.map((k) => {
  const [lng, lat, floorNo] = k.split(",");

  return {
    coord: [
      parseFloat(lng),
      parseFloat(lat),
    ],
    floor: parseInt(floorNo),
  };
});

console.log("ROUTE COORDS:", coords);

// persist full route
routePathRef.current = coords;

// persist graph
graphRef.current = graph;

// render current floor only
renderRouteForFloor(coords, floor);

};
useEffect(() => {
  if (!routePathRef.current?.length) return;

  renderRouteForFloor(
    routePathRef.current,
    floor
  );
}, [floor]);
  const searchPlaces = (query) => {
    if (!geo || !query) return [];
    const q = query.toLowerCase();
    const seen = new Set();
    const results = [];
    for (const f of geo.features) {
      const name = f.properties?.name;
      if (!name) continue;
      const lower = name.toLowerCase();
      if (!lower.includes(q)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      results.push(f);
      if (results.length >= 5) break;
    }
    return results;
  };

  const handleSourceSearch = (val) => {
    setSourceQuery(val);
    setSourceResults(searchPlaces(val));
  };

  const handleDestSearch = (val) => {
    setDestQuery(val);
    setDestResults(searchPlaces(val));
  };

  const selectSource = (feature) => {
  const map = mapRef.current;
  if (!map) return;

  const coords =
    feature.properties?.centroid ||
    feature.geometry.coordinates;

  // create marker ONLY after selecting from search
  if (!sourceRef.current) {
    sourceRef.current = new maplibregl.Marker({
      color: "green",
    })
      .setLngLat(coords)
      .addTo(map);
  } else {
    sourceRef.current.setLngLat(coords);
  }

  setSourceQuery(feature.properties?.name || "");
  setSourceResults([]);

  // fly to selected place
  map.flyTo({
    center: coords,
    zoom: 20,
  });

  // route only if both markers exist
  if (sourceRef.current && destRef.current) {
    handleRouting();
  }
};

const selectDest = (feature) => {
  const map = mapRef.current;
  if (!map) return;

  const coords =
    feature.properties?.centroid ||
    feature.geometry.coordinates;

  // create marker ONLY after selecting from search
  if (!destRef.current) {
    destRef.current = new maplibregl.Marker({
      color: "red",
    })
      .setLngLat(coords)
      .addTo(map);
  } else {
    destRef.current.setLngLat(coords);
  }

  setDestQuery(feature.properties?.name || "");
  setDestResults([]);

  // fly to selected place
  map.flyTo({
    center: coords,
    zoom: 20,
  });

  // route only if both markers exist
  if (sourceRef.current && destRef.current) {
    handleRouting();
  }
};

  const dropdownStyle = {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 6,
    maxHeight: 150,
    overflowY: "auto",
  };
  const itemStyle = {
    padding: 8,
    cursor: "pointer",
    borderBottom: "1px solid #eee",
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      {/* 🔍 SEARCH PANEL */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 20, width: 260 }}>
        <input
          placeholder="Search Source"
          value={sourceQuery}
          onChange={(e) => handleSourceSearch(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 6, borderRadius: 6, border: "1px solid #ccc" }}
        />
        {sourceResults.length > 0 && (
          <div style={dropdownStyle}>
            {sourceResults.map((f, i) => (
              <div key={i} style={itemStyle} onClick={() => selectSource(f)}>
                {f.properties?.name || "Unnamed"}
              </div>
            ))}
          </div>
        )}

        <input
          placeholder="Search Destination"
          value={destQuery}
          onChange={(e) => handleDestSearch(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 10, borderRadius: 6, border: "1px solid #ccc" }}
        />
        {destResults.length > 0 && (
          <div style={dropdownStyle}>
            {destResults.map((f, i) => (
              <div key={i} style={itemStyle} onClick={() => selectDest(f)}>
                {f.properties?.name || "Unnamed"}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🏢 FLOOR SWITCHER */}
      {venueData?.floors?.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 10,
            background: "#fff",
            borderRadius: 8,
            padding: 8,
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          {venueData.floors.map((f) => (
            <button
              key={f}
              // onClick={() => setFloor(f)}
              onClick={() => switchFloor(f)}
              style={{
                display: "block",
                margin: "4px 0",
                padding: "6px 10px",
                width: "100%",
                cursor: "pointer",
                borderRadius: 6,
                border: "none",
                background: f === floor ? "#007AFF" : "#eee",
                color: f === floor ? "#fff" : "#000",
                fontWeight: f === floor ? "bold" : "normal",
              }}
            >
              Floor {f}
            </button>
          ))}
        </div>
      )}

      <div ref={containerRef} style={{ height: "100%" }} />
    </div>
  );
}