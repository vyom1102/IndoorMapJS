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

const getFeatureTopHeight = (props = {}) => {
  const baseHeight = Number(props.baseHeight ?? 0) || 0;
  const type = String(props.type || "").toLowerCase();
  const parsedHeight = Number(props.height);
  const hasValidHeight = Number.isFinite(parsedHeight) && parsedHeight > 0;

  if (type === "wall") return baseHeight + (hasValidHeight ? parsedHeight : 4);
  if (type === "booth") return baseHeight + 2;
  if (type === "green area" || type === "green area | pots") return baseHeight + 0.2;
  return baseHeight + (hasValidHeight ? parsedHeight : 3);
};



const getFeatureAnchorCoordinates = (feature) => {
  const geometryType = feature?.geometry?.type;
  if (geometryType === "Point") return feature.geometry?.coordinates || null;
  if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
    // ✅ Use pole of inaccessibility instead of centroid
    return getPoleOfInaccessibility(feature.geometry);
  }
  return null;
};
// Add this utility function at the top of your file (after imports)
const getPoleOfInaccessibility = (geometry) => {
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;

  if (!ring?.length) return null;

  // Get bounding box
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }

  const width = maxLng - minLng;
  const height = maxLat - minLat;
  const cellSize = Math.min(width, height) / 16; // precision grid
  if (cellSize === 0) return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

  // Point-in-polygon check (ray casting)
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

  // Distance from point to polygon edge (minimum)
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

  // Grid search for best cell (highest distance from edges)
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

export default function IndoorMap() {
  const { mapRef, containerRef, ready } = useMap();

  const [geo, setGeo] = useState(null);
  const [floor, setFloor] = useState(0);
  const [venueData, setVenueData] = useState(null);
  const markersRef = useRef([]);
  const sourceRef = useRef(null);
  const destRef = useRef(null);
  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

const [sourceResults, setSourceResults] = useState([]);
const [destResults, setDestResults] = useState([]);
  const venueName = "PIECC"; // "NationalZoologicalPark";
  const defaultCenter = venueData
  ? [venueData.lng, venueData.lat]
  : [77.2437, 28.6063];
  useEffect(() => {
  if (!venueName) return;

  const loadVenue = async () => {
    const data = await loadVenueData(venueName);
    if (!data) return;

    setVenueData(data);

    // 🔥 move camera to venue
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: [data.lng, data.lat],
        zoom: 18,
      });
    }

    // 🔥 set floor
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
  // 🧱 Rendering Logic
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo || !ready) return;

    const render = async () => {
      const floorFeatures = geo.features.filter(
        (f) => (f.properties?.floor ?? 0) === floor
      );

const { rooms, boundaries, animals, sections, sponsorPoints, exhibitorPoints } =
  splitFeatures(floorFeatures);

      // 🔥 Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // 🔥 CLEAN layers
      const layers = map.getStyle()?.layers || [];
      layers.forEach((l) => {
        if (
          l.id.startsWith("floor_") ||
          l.id.startsWith("animal") ||
          l.id.startsWith("sponsor") ||
          l.id.startsWith("exhibitor")
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
          id.startsWith("exhibitor")
        ) {
          if (map.getSource(id)) map.removeSource(id);
        }
      });

      // 🧱 BOUNDARY
      map.addSource(`floor_${floor}_boundary`, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: boundaries,
        },
      });

      map.addLayer({
        id: `floor_${floor}_boundary`,
        type: "fill",
        source: `floor_${floor}_boundary`,
        paint: {
          "fill-color": "#D4DBDD",
          "fill-opacity": 1,
        },
      });

      // 🧩 SECTIONS (low zoom layer)

      // 🏢 ROOMS (3D)
      map.addSource(`floor_${floor}_rooms`, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: rooms,
        },
      });

      map.addLayer({
  id: `floor_${floor}_rooms`,
  type: "fill-extrusion",
  source: `floor_${floor}_rooms`,

  paint: {
    // 🎨 COLOR LOGIC
    "fill-extrusion-color": [
      "case",

      // custom color
      [
        "all",
        ["has", "fillColor"],
        ["!=", ["get", "fillColor"], "undefined"]
      ],
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

      ["in", ["downcase", ["get", "type"]],
        ["literal", ["green area", "green area | pots"]]], "#ADFA9E",

      ["==", ["get", "type"], "Wall"], "#DCDCDC",
      ["==", ["get", "type"], "Piller"], "#5D4037",
      ["==", ["get", "type"], "Terrace"], "#00695C",

      "#B9BBBD"
    ],

    // 🏗 HEIGHT LOGIC (IDENTICAL TO FLUTTER)
    "fill-extrusion-height": [
      "case",

      // WALL
      ["==", ["downcase", ["get", "type"]], "wall"],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        [
          "case",
          [
            "all",
            ["has", "height"],
            ["!=", ["get", "height"], "undefined"],
            [">", ["to-number", ["get", "height"]], 0]
          ],
          ["to-number", ["get", "height"]],
          4
        ]
      ],

      // BOOTH
      ["==", ["get", "type"], "Booth"],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        2
      ],

      // GREEN AREA
      ["in", ["downcase", ["get", "type"]],
        ["literal", ["green area", "green area | pots"]]],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        0.2
      ],

      // NORMAL HEIGHT
      [
        "all",
        ["has", "height"],
        ["!=", ["get", "height"], "undefined"],
        [">", ["to-number", ["get", "height"]], 0]
      ],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        ["to-number", ["get", "height"]]
      ],

      // DEFAULT HEIGHT
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        3
      ]
    ],

    // 🧱 BASE HEIGHT
    "fill-extrusion-base": [
      "case",
      ["has", "baseHeight"],
      ["to-number", ["get", "baseHeight"]],
      0
    ],

    "fill-extrusion-opacity": 1
  }
});

      map.addSource(`floor_${floor}_sections`, {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: sections,
  },
});

      map.addLayer({
  id: `floor_${floor}_sections`,
  type: "fill-extrusion", // 🔥 3D now
  source: `floor_${floor}_sections`,
  maxzoom: 17,
  paint: {
    "fill-extrusion-color": [
      "coalesce",
      ["get", "fillColor"],
      "#ccc",
    ],

    // 🔥 DEFAULT HEIGHT = 3.1
    "fill-extrusion-height": [
      "coalesce",
      ["to-number", ["get", "height"]],
      3.1
    ],

    "fill-extrusion-opacity": 1,
  },
});
      // 🎨 PATTERNS
      rooms.forEach((f, i) => {
        if (!f.properties?.pattern) return;

        const pat = addPatternImage(map, f.properties);

        const src = `pattern_${floor}_${i}`;

        map.addSource(src, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [f],
          },
        });

        map.addLayer({
          id: src,
          type: "fill",
          source: src,
          paint: {
            "fill-pattern": pat,
          },
        });
      });

      // 🐘 ANIMALS
      const features = [];

      for (const f of animals) {
        const p = f.properties || {};
        const coords =
          p.centroid || f.geometry.coordinates;

        const model = p.animalRef?.model_3d;
        const iconUrl = p.animalRef?.icon;

        // 👉 3D MODEL
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

          const marker = new maplibregl.Marker({
            element: el,
            // anchor: "center",
            // pitchAlignment: "viewport",
            // rotationAlignment: "viewport",
          })
            .setLngLat(coords)
            .addTo(map);

          markersRef.current.push(marker);
          continue;
        }

        // 👉 ICON fallback
        const iconId = iconUrl
          ? `animal_${iconUrl.split("/").pop()}`
          : "default";

        if (iconUrl && !map.hasImage(iconId)) {
          // const img = await map.loadImage(iconUrl);
          // map.addImage(iconId, img.data);
           new Promise((resolve, reject) => {
  map.loadImage(iconUrl, (err, image) => {
    if (err) return reject(err);

    if (!map.hasImage(iconId)) {
      map.addImage(iconId, image);
    }

    resolve();
  });
});
}

        const pillId = createPillImage(
          map,
          p.name || "Animal"
        );

        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: coords,
          },
          properties: {
            icon: iconId,
            pill: pillId,
          },
        });
      }

      // 🗿 LANDMARK GLB OBJECTS (objectFile -> baseUrl/uploads/objectFile)
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
        })
          .setLngLat(coords)
          .addTo(map);
        markersRef.current.push(marker);
      }

      // 🔥 Animal source
      map.addSource("animal-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      });

      // 🐾 Icon layer
      map.addLayer({
        id: "animal-icon",
        type: "symbol",
        source: "animal-source",
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 0.08,
            15, 0.18,
            17, 0.32,
            19, 0.45,
            21, 0.6,
          ],
          "icon-anchor": "bottom",
        },
      });

      // 🏷️ Label layer
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

      // 💼 SPONSOR LOGOS AS 3D PLANES ON POLYGON TOP (Z=3) + NAMES
      const sponsorLogoPlanes = [];
      const sponsorNameFeatures = [];
      const textureLoader = new THREE.TextureLoader();
      textureLoader.setCrossOrigin("anonymous");
      const textureCache = new Map();

      const polygonLookup = new Map();
      for (const feature of floorFeatures) {
        const geometryType = feature.geometry?.type;
        if (geometryType !== "Polygon" && geometryType !== "MultiPolygon") continue;

        const keys = [
          feature.id,
          feature._id,
          feature.properties?.id,
          feature.properties?._id,
        ].filter(Boolean);

        keys.forEach((key) => polygonLookup.set(String(key), feature));
      }

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

        for (const polyId of polygonIds) {
          const linkedPolygon = polygonLookup.get(polyId);
          if (!linkedPolygon) continue;

          const center = getPoleOfInaccessibility(linkedPolygon.geometry);
          if (!center) continue;

          const minDimMeters = getPolygonMinDimensionMeters(linkedPolygon.geometry);
          const { widthM, heightM } = getPolygonDimensionsMeters(linkedPolygon.geometry);
          const roofZ = getFeatureTopHeight(linkedPolygon.properties) + 0.06;

          if (!textureCache.has(logo)) {
            try {
              const texture = await textureLoader.loadAsync(logo);
              textureCache.set(logo, texture);
            } catch (e) {
              textureCache.set(logo, null);
            }
          }

          const texture = textureCache.get(logo);
          if (texture) {
            const aspect =
              texture?.image?.width && texture?.image?.height
                ? texture.image.width / texture.image.height
                : 0.8;

            // const maxWidth = Math.max(0.8, widthM * 0.75 || minDimMeters * 0.75 || 0.8);
            // const maxHeight = Math.max(0.8, heightM * 0.75 || minDimMeters * 0.75 || 0.8);
            // let scaleX = maxWidth;
            // let scaleY = maxHeight;

            // if (aspect >= 1) {
            //   scaleY = Math.min(maxHeight, maxWidth / aspect);
            // } else {
            //   scaleX = Math.min(maxWidth, maxHeight * aspect);
            // }
            const maxWidth = Math.max(0.3, widthM * 0.65);
            const maxHeight = Math.max(0.3, heightM * 0.65);

            let scaleX, scaleY;
            if (maxWidth / aspect <= maxHeight) {
              scaleX = maxWidth;
              scaleY = maxWidth / aspect;
            } else {
              scaleY = maxHeight;
              scaleX = maxHeight * aspect;
            }
            // Hard clamp — logo never escapes polygon footprint
            scaleX = Math.min(scaleX, maxWidth);
            scaleY = Math.min(scaleY, maxHeight);
            sponsorLogoPlanes.push({
              center,
              texture,
              scaleX,
              scaleY,
              z: roofZ,
              rot: getPolygonRotationRad(linkedPolygon.geometry),
            });
          }

          if (!labelPlaced && sponsorName) {
            sponsorNameFeatures.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [center[0], center[1], roofZ] },
              properties: { name: sponsorName },
            });
            labelPlaced = true;
          }
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

      const sponsorLogoLayerId = `sponsor-logo-3d-${floor}`;
      if (sponsorLogoPlanes.length) {
        map.addLayer({
          id: sponsorLogoLayerId,
          type: "custom",
          renderingMode: "3d",
          onAdd: function onAddCustom(_map, gl) {
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

            this.planes = sponsorLogoPlanes.map(({ center, texture, scaleX, scaleY, z, rot }) => {
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
          render: function renderCustom(gl, matrix) {
            const base = new THREE.Matrix4().fromArray(matrix);

            this.renderer.state.reset();
            this.renderer.clearDepth();

            this.planes.forEach((plane) => {
              this.mesh.material.map = plane.texture;
              this.mesh.material.needsUpdate = true;
              const rotationX = new THREE.Matrix4().makeRotationAxis(
              new THREE.Vector3(1, 0, 0),
              Math.PI  // flip to face upward (plane faces +Z)
            );

            const rotationZ = new THREE.Matrix4().makeRotationAxis(
              new THREE.Vector3(0, 0, 1),
              plane.rot || 0  // align to polygon's longest edge, no extra offset
            );

            const modelMatrix = new THREE.Matrix4()
              .makeTranslation(plane.tx, plane.ty, plane.tz)
              .multiply(rotationZ)
              .multiply(rotationX)
              .scale(new THREE.Vector3(plane.sx, plane.sy, 1));
              // const rotationZ = new THREE.Matrix4().makeRotationAxis(
              //   new THREE.Vector3(0, 0, 1),
              //   Math.PI / 2 + (plane.rot || 0)
              // );

              // const modelMatrix = new THREE.Matrix4()
              //   .makeTranslation(plane.tx, plane.ty, plane.tz)
              //   .multiply(rotationZ)
              //   .scale(
              //     new THREE.Vector3(
              //       plane.sx,
              //       -plane.sy,
              //       plane.sx
              //     )
              //   );
              this.camera.projectionMatrix = base.clone().multiply(modelMatrix);
              this.renderer.render(this.scene, this.camera);
            });

            map.triggerRepaint();
          },
          onRemove: function onRemoveCustom() {
            this.mesh?.geometry?.dispose?.();
            this.mesh?.material?.dispose?.();
            this.renderer?.dispose?.();
          },
        });
      }

      // 🏢 EXHIBITOR LOGOS AS 3D PLANES ON POLYGON TOP (same as sponsor)
      const exhibitorLogoPlanes = [];
      for (const pointFeature of exhibitorPoints) {
        const p = pointFeature.properties || {};
        const logo = p.exhibitorRef?.brandingDetails?.companyLogo;
        if (!logo) continue;

        const polygonIds = [
          ...(p.associatedPolygons || []),
          ...(pointFeature.associatedPolygons || []),
        ].map(String);

        for (const polyId of polygonIds) {
          const linkedPolygon = polygonLookup.get(polyId);
          if (!linkedPolygon) continue;

          const center = getPoleOfInaccessibility(linkedPolygon.geometry);
          if (!center) continue;

          const minDimMeters = getPolygonMinDimensionMeters(linkedPolygon.geometry);
          const { widthM, heightM } = getPolygonDimensionsMeters(linkedPolygon.geometry);
          const roofZ = getFeatureTopHeight(linkedPolygon.properties) + 0.06;

          if (!textureCache.has(logo)) {
            try {
              const texture = await textureLoader.loadAsync(logo);
              textureCache.set(logo, texture);
            } catch (e) {
              textureCache.set(logo, null);
            }
          }

          const texture = textureCache.get(logo);
          if (!texture) continue;

          const aspect =
            texture?.image?.width && texture?.image?.height
              ? texture.image.width / texture.image.height
              : 0.8;

          // const maxWidth = Math.max(0.8, widthM * 0.9 || minDimMeters * 0.9 || 0.8);
          // const maxHeight = Math.max(0.8, heightM * 0.9 || minDimMeters * 0.9 || 0.8);
          // let scaleX = maxWidth;
          // let scaleY = maxHeight;

          // if (aspect >= 1) {
          //   scaleY = Math.min(maxHeight, maxWidth / aspect);
          // } else {
          //   scaleX = Math.min(maxWidth, maxHeight * aspect);
          // }

          // AFTER (exhibitor)
        const maxWidth = Math.max(0.3, widthM * 0.65);
        const maxHeight = Math.max(0.3, heightM * 0.65);

        let scaleX, scaleY;
        if (maxWidth / aspect <= maxHeight) {
          scaleX = maxWidth;
          scaleY = maxWidth / aspect;
        } else {
          scaleY = maxHeight;
          scaleX = maxHeight * aspect;
        }
        scaleX = Math.min(scaleX, maxWidth);
        scaleY = Math.min(scaleY, maxHeight);
          exhibitorLogoPlanes.push({
            center,
            texture,
            scaleX,
            scaleY,
            z: roofZ,
            rot: getPolygonRotationRad(linkedPolygon.geometry),
          });
        }
      }

      const exhibitorLogoLayerId = `exhibitor-logo-3d-${floor}`;
      if (exhibitorLogoPlanes.length) {
        map.addLayer({
          id: exhibitorLogoLayerId,
          type: "custom",
          renderingMode: "3d",
          onAdd: function onAddCustom(_map, gl) {
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

            this.planes = exhibitorLogoPlanes.map(({ center, texture, scaleX, scaleY, z, rot }) => {
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
          render: function renderCustom(gl, matrix) {
            const base = new THREE.Matrix4().fromArray(matrix);

            this.renderer.state.reset();
            this.renderer.clearDepth();

            this.planes.forEach((plane) => {
              this.mesh.material.map = plane.texture;
              this.mesh.material.needsUpdate = true;
              const rotationX = new THREE.Matrix4().makeRotationAxis(
              new THREE.Vector3(1, 0, 0),
              Math.PI  // flip to face upward (plane faces +Z)
            );

            const rotationZ = new THREE.Matrix4().makeRotationAxis(
              new THREE.Vector3(0, 0, 1),
              plane.rot || 0  // align to polygon's longest edge, no extra offset
            );

            const modelMatrix = new THREE.Matrix4()
              .makeTranslation(plane.tx, plane.ty, plane.tz)
              .multiply(rotationZ)
              .multiply(rotationX)
              .scale(new THREE.Vector3(plane.sx, plane.sy, 1));
              // const rotationZ = new THREE.Matrix4().makeRotationAxis(
              //   new THREE.Vector3(0, 0, 1),
              //   Math.PI / 2 + (plane.rot || 0)
              // );

              // const modelMatrix = new THREE.Matrix4()
              //   .makeTranslation(plane.tx, plane.ty, plane.tz)
              //   .multiply(rotationZ)
              //   .scale(new THREE.Vector3(plane.sx, -plane.sy, plane.sx));
              this.camera.projectionMatrix = base.clone().multiply(modelMatrix);
              this.renderer.render(this.scene, this.camera);
            });

            map.triggerRepaint();
          },
          onRemove: function onRemoveCustom() {
            this.mesh?.geometry?.dispose?.();
            this.mesh?.material?.dispose?.();
            this.renderer?.dispose?.();
          },
        });
      }

      // map.addSource("sponsor-name-source", {
      //   type: "geojson",
      //   data: {
      //     type: "FeatureCollection",
      //     features: sponsorNameFeatures,
      //   },
      // });

      // map.addLayer({
      //   id: "sponsor-name",
      //   type: "symbol",
      //   source: "sponsor-name-source",
      //   minzoom: 17,
      //   layout: {
      //     "text-field": ["get", "name"],
      //     "text-size": 11,
      //     "text-anchor": "top",
      //     "text-offset": [0, 1.1],
      //     "text-allow-overlap": false,
      //   },
      //   paint: {
      //     "text-color": "#111",
      //     "text-halo-color": "#fff",
      //     "text-halo-width": 1,
      //   },
      // });
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

      map.flyTo({
        center: coords,
        zoom: 20,
      });
    };

    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [ready]);


useEffect(() => {
  const map = mapRef.current;
  if (!map || !ready || !venueData) return;

  if (sourceRef.current || destRef.current) return;

  const center = [venueData.lng, venueData.lat];

  const src = new maplibregl.Marker({
    draggable: true,
    color: "green",
  })
    .setLngLat(center)
    .addTo(map);

  const dest = new maplibregl.Marker({
    draggable: true,
    color: "red",
  })
    .setLngLat([
      center[0] + 0.0003,
      center[1] + 0.0003,
    ])
    .addTo(map);

  sourceRef.current = src;
  destRef.current = dest;

  // 🔥 ATTACH ROUTING HERE (IMPORTANT)
  const run = () => handleRouting();

  src.on("dragend", run);
  dest.on("dragend", run);

}, [ready, venueData]);

const handleRouting = async () => {
  const map = mapRef.current;



  // if (!map || !sourceRef.current || !destRef.current) return;

  const src = sourceRef.current.getLngLat();
  const dest = destRef.current.getLngLat();
  console.log("SRC:", src);
  console.log("DEST:", dest);
  // 🔥 call your API
  const graph = await fetchNearbyNodes(src.lat, src.lng);

  console.log("GRAPH:", graph);
  if (!graph) return;

  const start = findClosestNode(graph, src);
  const end = findClosestNode(graph, dest);

  console.log("START:", start);
  console.log("END:", end);
  const path = dijkstra(graph, start.key, end.key);

   console.log("PATH:", path);
  const coords = path.map((k) => {
    const [lng, lat] = k.split(",");
    return [parseFloat(lng), parseFloat(lat)];
  });

  const routeGeo = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coords,
    },
  };

  // 🔥 draw/update route
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
      paint: {
        "line-color": "#007AFF",
        "line-width": 5,
      },
    });
  }
};

// const searchPlaces = (query) => {
//   if (!geo || !query) return [];

//   const q = query.toLowerCase();

//   return geo.features
//     .filter((f) => {
//       const name = f.properties?.name || "";
//       return name.toLowerCase().includes(q);
//     })
//     .slice(0, 5);
// };
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

    // 🔥 skip duplicates
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
  const coords =
    feature.properties?.centroid ||
    feature.geometry.coordinates;

  if (sourceRef.current) {
    sourceRef.current.setLngLat(coords);
  }

  setSourceQuery(feature.properties?.name || "");
  setSourceResults([]);

  handleRouting();
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
const selectDest = (feature) => {
  const coords =
    feature.properties?.centroid ||
    feature.geometry.coordinates;

  if (destRef.current) {
    destRef.current.setLngLat(coords);
  }

  setDestQuery(feature.properties?.name || "");
  setDestResults([]);

  handleRouting();
};
return (
  <div style={{ height: "100vh", width: "100%", position: "relative" }}>
    {/* 🔍 SEARCH PANEL */}
<div
  style={{
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 20,
    width: 260,
  }}
>
  {/* SOURCE */}
  <input
    placeholder="Search Source"
    value={sourceQuery}
    onChange={(e) => handleSourceSearch(e.target.value)}
    style={{
      width: "100%",
      padding: 8,
      marginBottom: 6,
      borderRadius: 6,
      border: "1px solid #ccc",
    }}
  />

  {sourceResults.length > 0 && (
    <div style={dropdownStyle}>
      {sourceResults.map((f, i) => (
        <div
          key={i}
          style={itemStyle}
          onClick={() => selectSource(f)}
        >
          {f.properties?.name || "Unnamed"}
        </div>
        
      ))}
    </div>
  )}

  {/* DESTINATION */}
  <input
    placeholder="Search Destination"
    value={destQuery}
    onChange={(e) => handleDestSearch(e.target.value)}
    style={{
      width: "100%",
      padding: 8,
      marginTop: 10,
      borderRadius: 6,
      border: "1px solid #ccc",
    }}
  />

  {destResults.length > 0 && (
    <div style={dropdownStyle}>
      {destResults.map((f, i) => (
        <div
          key={i}
          style={itemStyle}
          onClick={() => selectDest(f)}
        >
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
            onClick={() => setFloor(f)}
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
  // return (
  //   <div style={{ height: "100vh", width: "100%" }}>
  //     <div ref={containerRef} style={{ height: "100%" }} />
  //   </div>
  // );
}