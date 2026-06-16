import {
  ESCALATOR_MODEL_URL,
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

export const getEscalatorModelUrl = (feature) => {
  return getObjectFileUrl(feature?.properties?.objectFile) || ESCALATOR_MODEL_URL;
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