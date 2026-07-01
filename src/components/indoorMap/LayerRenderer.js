import { splitFeatures } from "../../utils/splitFeatures";
import { addPatternImage } from "../../utils/patterns";
import { createPillImage } from "../../utils/pill";
import {
  getImageFileUrl,
  getObjectFileUrl,
} from "../indoorMap/assetUrls";
import {
  getFeatureAnchorCoordinates,
  getFeatureBaseHeight,
  getFeatureTopHeight,
  getPoleOfInaccessibility,
  getPolygonCenter,
  getPolygonRotationRad,
} from "../indoorMap/geometry";
import {
  isEscalatorFeature,
  isSittingAreaFeature,
} from "../indoorMap/featureTypes";
import maplibregl from "maplibre-gl";
import * as THREE from "three";

const defaultIcons = {
  cafeteria: "/assets/icons/cafeteria.png",
  lift: "/assets/icons/lift.png",
  maleWashroom: "/assets/icons/maleWashroom.png",
  femaleWashroom: "/assets/icons/femaleWashroom.png",
  unisexWashroom: "/assets/icons/unisex_washroom.png",
  accessibleWashroom: "/assets/icons/accessibleWashroom.png",
  stairs: "/assets/icons/stairs.png",
  water: "/assets/icons/water.png",
  reception: "/assets/icons/reception.png",
  mainEntry: "/assets/icons/entry.png",
  exitOnly: "/assets/icons/exit.png",
};

export const ensureDefaultIcon = async (map, iconId, imagePath) => {
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

export const preloadDefaultIcons = async (map) => {
  await Promise.all([
    ensureDefaultIcon(map, "cafeteria-default", defaultIcons.cafeteria),
    ensureDefaultIcon(map, "lift-default", defaultIcons.lift),
    ensureDefaultIcon(
      map,
      "male-washroom-default",
      defaultIcons.maleWashroom
    ),
    ensureDefaultIcon(
      map,
      "female-washroom-default",
      defaultIcons.femaleWashroom
    ),
    ensureDefaultIcon(
      map,
      "unisex-washroom-default",
      defaultIcons.unisexWashroom
    ),
    ensureDefaultIcon(map, "stairs-default", defaultIcons.stairs),
    ensureDefaultIcon(map, "water-default", defaultIcons.water),
    ensureDefaultIcon(map, "reception-default", defaultIcons.reception),
    ensureDefaultIcon(map, "main-entry-default", defaultIcons.mainEntry),
    ensureDefaultIcon(map, "exit-only-default", defaultIcons.exitOnly),
    ensureDefaultIcon(
      map,
      "accessible-washroom-default",
      defaultIcons.accessibleWashroom
    ),
  ]);
};

const ICON_TO_CATEGORY = {
  "cafeteria-default": "Cafeteria",
  "lift-default": "Lift",
  "male-washroom-default": "Male Washroom",
  "female-washroom-default": "Female Washroom",
  "unisex-washroom-default": "Unisex Washroom",
  "accessible-washroom-default": "Accessible Washroom",
  "stairs-default": "Stairs",
  "water-default": "Drinking Water",
  "reception-default": "Reception",
  "main-entry-default": "Main Entry",
  "exit-only-default": "Exit Only",
};
export const renderDefaultPoiLayer = async (
  map,
  floorFeatures,
  floor,
  shouldRender = () => true
) => {
  await preloadDefaultIcons(map);
  if (!shouldRender()) return;

  const polygonLookup = new Map();
  for (const feature of floorFeatures) {
    const geometryType = feature.geometry?.type;
    if (geometryType !== "Polygon" && geometryType !== "MultiPolygon")
      continue;
    const keys = [
      feature.id,
      feature._id,
      feature.properties?.id,
      feature.properties?._id,
    ].filter(Boolean);
    keys.forEach((key) => polygonLookup.set(String(key), feature));
  }

  const defaultPoiFeatures = [];

  for (const feature of floorFeatures) {
    const p = feature.properties || {};

    const geometryType = feature.geometry?.type || "";
    const type = String(p.type || p.polygonType || p.subType || "").toLowerCase();
    const polygonType = String(p.polygonType || "").toLowerCase();
    const name = String(p.name || "").trim();

    let icon = null;
    let label = "";
    let center = null;

    if (
      geometryType === "Point" &&
      (type.includes("counter") || type.includes("security check") ||
        polygonType.includes("security check"))
    ) {
      icon = "reception-default";

      const isSecurityCheck =
        type.includes("security check") ||
        polygonType.includes("security check");

      label =
        name || (isSecurityCheck ? "Security Check" : "Counter");

      const polygonIds = [
        ...(p.associatedPolygons || []),
        ...(feature.associatedPolygons || []),
      ].map(String);

      let linkedPolygon = null;

      for (const polyId of polygonIds) {
        const poly = polygonLookup.get(polyId);

        if (poly) {
          linkedPolygon = poly;
          break;
        }
      }

      if (linkedPolygon) {
        center =
          getPoleOfInaccessibility(linkedPolygon.geometry) ||
          getPolygonCenter(linkedPolygon.geometry);
      }

      if (!center) {
        center = p.centroid || feature.geometry.coordinates;
      }
    } else if (type.includes("lift") || polygonType.includes("lift")) {
      icon = "lift-default";
      label = "";
    } else if (
      type.includes("female washroom") ||
      polygonType.includes("female washroom") ||
      (type.includes("washroom") && name.toLowerCase().includes("female"))
    ) {
      icon = "female-washroom-default";
      label = "";
    } else if (
      type.includes("male washroom") ||
      polygonType.includes("male washroom") ||
      (type.includes("washroom") && name.toLowerCase().includes("male"))
    ) {
      icon = "male-washroom-default";
      label = "";
    } else if (
      type.includes("unisex washroom") ||
      polygonType.includes("unisex washroom")
    ) {
      icon = "unisex-washroom-default";
      label = "";
    } else if (
      type.includes("accessible washroom") ||
      polygonType.includes("accessible washroom")
    ) {
      icon = "accessible-washroom-default";
      label = "";
    } else if (
      type.includes("drinking water") ||
      polygonType.includes("drinking water")
    ) {
      icon = "water-default";
      label = "Water";
    } else if (
      type.includes("stairs") &&
      feature.geometry?.type !== "Polygon" &&
      feature.geometry?.type !== "MultiPolygon"
    ) {
      icon = "stairs-default";
      label = "";

      if (feature.geometry?.type === "Point") {
        center = feature.geometry.coordinates;
      }

      if (!center) {
        center = p.centroid || feature.geometry?.coordinates;
      }
    } else if (
      (type.includes("main entry") || polygonType.includes("main entry")) &&
      feature.geometry?.type === "Point"
    ) {
      icon = "main-entry-default";
      label = name || "Main Entry";
      center = feature.geometry.coordinates;
    } else if (
      (type.includes("exit only") || polygonType.includes("exit only")) &&
      feature.geometry?.type === "Point"
    ) {
      icon = "exit-only-default";
      label = name || "Exit Only";
      center = feature.geometry.coordinates;
    } else if (
      type.includes("reception") ||
      polygonType.includes("reception")
    ) {
      icon = "reception-default";
      // label = "Reception";
    }

    if (!icon) continue;

    if (!center) {
      center =
        p.centroid ||
        getPoleOfInaccessibility(feature.geometry) ||
        getPolygonCenter(feature.geometry);
    }

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
        type: ICON_TO_CATEGORY[icon],
      },
    });
  }

  if (defaultPoiFeatures.length) {
    if (!shouldRender()) return;

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
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          17,
          10,
          19,
          12,
          21,
          14,
        ],
        "text-anchor": "top",

        "text-allow-overlap": false,
        "icon-allow-overlap": false,
        "text-ignore-placement": false,
        "icon-ignore-placement": false,
      },
      paint: {
        "text-color": "#111",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });
  }
};

export const renderAnimalMarkers = async (
  map,
  animals,
  markersRef,
  FIXED_GLB_SIZE_PX
) => {
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
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);
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
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        0.08,
        15,
        0.18,
        17,
        0.32,
        19,
        0.45,
        21,
        0.6,
      ],
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
};

export const renderLandmarkGlbObjects = (
  map,
  floorFeatures,
  markersRef,
  FIXED_GLB_SIZE_PX
) => {
  for (const feature of floorFeatures) {
    const p = feature.properties || {};
    if (isEscalatorFeature(feature)) continue;
    if (isSittingAreaFeature(feature)) continue;
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
};
