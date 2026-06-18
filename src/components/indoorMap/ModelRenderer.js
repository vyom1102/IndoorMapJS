import {
  getEscalatorModelUrl,
  getSittingAreaModelUrl,
  isEscalatorPolygonFeature,
  isSittingAreaPolygonFeature,
  isEscalatorFeature,
  isSittingAreaFeature,
   getTreeModelUrl,
  isGreenAreaFeature,
  isParkingPolygonFeature,
  getCarModelUrl,
} from "./featureTypes";
import {
  getPoleOfInaccessibility,
  getPolygonCenter,
  getPolygonRotationRad,
  getFeatureBaseHeight,
} from "./geometry";
import {
  ESCALATOR_MODEL_HEIGHT_M,
  ESCALATOR_MODEL_LENGTH_M,
  ESCALATOR_MODEL_ROTATION_OFFSET_RAD,
  ESCALATOR_MODEL_UPRIGHT_ROLL_RAD,
  ESCALATOR_MODEL_WIDTH_M,
  SITTING_AREA_MODEL_HEIGHT_M,
  SITTING_AREA_MODEL_LENGTH_M,
  SITTING_AREA_MODEL_ROTATION_OFFSET_RAD,
  SITTING_AREA_MODEL_UPRIGHT_ROLL_RAD,
  SITTING_AREA_MODEL_WIDTH_M,
  TREE_MODEL_HEIGHT_M,
  TREE_MODEL_LENGTH_M,
  TREE_MODEL_ROTATION_OFFSET_RAD,
  TREE_MODEL_UPRIGHT_ROLL_RAD,
  TREE_MODEL_WIDTH_M,
  CAR_MODEL_HEIGHT_M,
  CAR_MODEL_LENGTH_M,
  CAR_MODEL_ROTATION_OFFSET_RAD,
  CAR_MODEL_UPRIGHT_ROLL_RAD,
  CAR_MODEL_WIDTH_M,
  CAR_FOOTPRINT_AREA_M2,
  CAR_MIN_COUNT,
  CAR_MAX_COUNT,
} from "./constants";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import bbox from "@turf/bbox";
export const buildEscalatorPlacements = (floorFeatures) => {
  const escalatorPointByPolygonId = new Map();
  const escalatorPlacementsByModel = new Map();

  for (const feature of floorFeatures) {
    if (feature.geometry?.type !== "Point") continue;
    if (!isEscalatorFeature(feature)) continue;

    const p = feature.properties || {};
    const polygonIds = [
      ...(p.associatedPolygons || []),
      ...(feature.associatedPolygons || []),
    ].map(String);

    for (const polyId of polygonIds) {
      escalatorPointByPolygonId.set(polyId, feature);
    }
  }

  const escalatorFeatures = floorFeatures.filter(
    isEscalatorPolygonFeature
  );

  for (const feature of escalatorFeatures) {
    const p = feature.properties || {};
    const modelUrl = getEscalatorModelUrl(feature);
    if (!modelUrl) continue;

    const polygonId = String(
      feature.id || feature._id || p.id || p._id || ""
    );

    const polygonCenter =
      (Array.isArray(p.centroid) ? p.centroid : null) ||
      getPoleOfInaccessibility(feature.geometry) ||
      getPolygonCenter(feature.geometry);

    if (!polygonCenter) continue;

    const pointFeature = escalatorPointByPolygonId.get(polygonId);

    let placementCoords;
    let rotationRad;

    if (pointFeature) {
      placementCoords = pointFeature.geometry.coordinates;

      const longAxisRad = getPolygonRotationRad(feature.geometry);

      const dx = polygonCenter[0] - placementCoords[0];
      const dy = polygonCenter[1] - placementCoords[1];

      const centerLat = (polygonCenter[1] + placementCoords[1]) / 2;
      const metersPerDegLng = Math.cos((centerLat * Math.PI) / 180);

      const dxM = dx * metersPerDegLng;
      const dyM = dy;

      const ax = Math.cos(longAxisRad);
      const ay = Math.sin(longAxisRad);
      const dot = dxM * ax + dyM * ay;

      rotationRad = dot >= 0 ? longAxisRad : longAxisRad + Math.PI;
    } else {
      placementCoords = polygonCenter;
      rotationRad = getPolygonRotationRad(feature.geometry);
    }

    if (!placementCoords) continue;

    const placements = escalatorPlacementsByModel.get(modelUrl) || [];
    placements.push({
      center: placementCoords,
      z: getFeatureBaseHeight(p) + 0.02,
      rot: rotationRad,
      footprint: {
        lengthM: ESCALATOR_MODEL_LENGTH_M,
        widthM: ESCALATOR_MODEL_WIDTH_M,
        heightM: ESCALATOR_MODEL_HEIGHT_M,
      },
      rotationOffsetRad: ESCALATOR_MODEL_ROTATION_OFFSET_RAD,
      uprightRollRad: ESCALATOR_MODEL_UPRIGHT_ROLL_RAD,
    });
    escalatorPlacementsByModel.set(modelUrl, placements);
  }

  return escalatorPlacementsByModel;
};

export const buildSittingAreaPlacements = (floorFeatures) => {
  const sittingAreaPlacementsByModel = new Map();
  const sittingAreaFeatures = floorFeatures.filter(
    isSittingAreaPolygonFeature
  );

  for (const feature of sittingAreaFeatures) {
    const p = feature.properties || {};
    const center =
      (Array.isArray(p.centroid) ? p.centroid : null) ||
      getPoleOfInaccessibility(feature.geometry) ||
      getPolygonCenter(feature.geometry);
    const modelUrl = getSittingAreaModelUrl(feature);

    if (!center || !modelUrl) continue;

    const placements = sittingAreaPlacementsByModel.get(modelUrl) || [];
    placements.push({
      center,
      z: getFeatureBaseHeight(p) + 0.02,
      rot: getPolygonRotationRad(feature.geometry),
      footprint: {
        lengthM: SITTING_AREA_MODEL_LENGTH_M,
        widthM: SITTING_AREA_MODEL_WIDTH_M,
        heightM: SITTING_AREA_MODEL_HEIGHT_M,
      },
      rotationOffsetRad: SITTING_AREA_MODEL_ROTATION_OFFSET_RAD,
      uprightRollRad: SITTING_AREA_MODEL_UPRIGHT_ROLL_RAD,
    });
    sittingAreaPlacementsByModel.set(modelUrl, placements);
  }

  return sittingAreaPlacementsByModel;
};
const generateTreePoints = (polygonFeature, count = 5) => {
  const points = [];
  const bounds = bbox(polygonFeature);

  let attempts = 0;

  while (points.length < count && attempts < count * 20) {
    attempts++;

    const lng =
      bounds[0] + Math.random() * (bounds[2] - bounds[0]);

    const lat =
      bounds[1] + Math.random() * (bounds[3] - bounds[1]);

    const p = point([lng, lat]);

    if (booleanPointInPolygon(p, polygonFeature)) {
      points.push([lng, lat]);
    }
  }

  return points;
};
const generateScatterPoints = generateTreePoints;
export const buildTreePlacements = (floorFeatures) => {
  const treePlacementsByModel = new Map();

  const greenAreas = floorFeatures.filter(isGreenAreaFeature);

  for (const feature of greenAreas) {
    const p = feature.properties || {};

    const center =
      (Array.isArray(p.centroid) ? p.centroid : null) ||
      getPoleOfInaccessibility(feature.geometry) ||
      getPolygonCenter(feature.geometry);

    if (!center) continue;

    const modelUrl = getTreeModelUrl();

    const placements =
      treePlacementsByModel.get(modelUrl) || [];

    placements.push({
      center,
      z: getFeatureBaseHeight(p) + 0.02,
      rot: 0,
      footprint: {
        lengthM: TREE_MODEL_LENGTH_M,
        widthM: TREE_MODEL_WIDTH_M,
        heightM: TREE_MODEL_HEIGHT_M,
      },
      rotationOffsetRad: TREE_MODEL_ROTATION_OFFSET_RAD,
      uprightRollRad: TREE_MODEL_UPRIGHT_ROLL_RAD,
    });

    treePlacementsByModel.set(modelUrl, placements);
  }

  return treePlacementsByModel;
};

export const buildCarPlacements = (floorFeatures) => {
  const carPlacementsByModel = new Map();

  const parkingAreas = floorFeatures.filter(isParkingPolygonFeature);

  for (const feature of parkingAreas) {
    const p = feature.properties || {};
    const modelUrl = getCarModelUrl();

    // Scale car count to the polygon's footprint, clamped to a sane range.
    let carCount = CAR_MIN_COUNT;
    try {
      const areaM2 = area(feature);
      carCount = Math.round(areaM2 / CAR_FOOTPRINT_AREA_M2);
    } catch {
      carCount = CAR_MIN_COUNT;
    }
    carCount = Math.min(CAR_MAX_COUNT, Math.max(CAR_MIN_COUNT, carCount));

    const scatterPoints = generateScatterPoints(feature, carCount);
    if (!scatterPoints.length) continue;

    const baseHeight = getFeatureBaseHeight(p) + 0.02;
    const rotationRad = getPolygonRotationRad(feature.geometry);

    const placements = carPlacementsByModel.get(modelUrl) || [];

    for (const coords of scatterPoints) {
      // small per-car yaw jitter (+/- ~8°) so cars don't look cloned
      const jitter = (Math.random() - 0.5) * (Math.PI / 22.5);

      placements.push({
        center: coords,
        z: baseHeight,
        rot: rotationRad + jitter,
        footprint: {
          lengthM: CAR_MODEL_LENGTH_M,
          widthM: CAR_MODEL_WIDTH_M,
          heightM: CAR_MODEL_HEIGHT_M,
        },
        rotationOffsetRad: CAR_MODEL_ROTATION_OFFSET_RAD,
        uprightRollRad: CAR_MODEL_UPRIGHT_ROLL_RAD,
      });
    }

    carPlacementsByModel.set(modelUrl, placements);
  }

  return carPlacementsByModel;
};