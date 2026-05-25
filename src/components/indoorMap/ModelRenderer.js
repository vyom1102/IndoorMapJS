import {
  getEscalatorModelUrl,
  getSittingAreaModelUrl,
  isEscalatorPolygonFeature,
  isSittingAreaPolygonFeature,
  isEscalatorFeature,
  isSittingAreaFeature,
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
} from "./constants";

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
