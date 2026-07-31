import axios from "axios";
import { getRuntimeConfig } from "../utils/runtimeConfig";

const { baseUrl, apiKey } = getRuntimeConfig();

/**
 * 3D model ("furniture") catalogue for a venue.
 *
 * Point features in the venue GeoJSON may carry a `3dRef` that is just an id
 * string instead of an inline primitive model. That id is matched against the
 * `_id` of the models returned by this endpoint.
 *
 * Mirrors FurnitureAPI.fetchFurniture in the unified_map_view Flutter package.
 */
export const fetchFurniture = async (venueName) => {
  if (!venueName) return [];

  try {
    const res = await axios.get(
      `${baseUrl}/secured/get-all-threed-models?venueName=${encodeURIComponent(
        venueName
      )}&api_key=${apiKey}`
    );

    const data = res?.data?.data;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Furniture (3D models) load error", e);
    return [];
  }
};

// ── Registry ────────────────────────────────────────────────────────────────
// The renderers resolve `3dRef` ids deep inside placement building, far from
// where the fetch happens. Rather than thread the list through every call, keep
// a module-level lookup — the same role VenueData.instance.furnitureData plays
// on the Flutter side.

let furnitureById = new Map();

export const setFurnitureModels = (models = []) => {
  const next = new Map();
  for (const model of models) {
    const id = model?._id ?? model?.id;
    if (id) next.set(String(id), model);
  }
  furnitureById = next;
};

export const clearFurnitureModels = () => {
  furnitureById = new Map();
};

export const getFurnitureModelById = (id) =>
  id == null ? null : furnitureById.get(String(id)) || null;

export const getFurnitureModelCount = () => furnitureById.size;

/**
 * Normalise a feature's `3dRef` into an inline model object ({ "3d": [...] }).
 *
 * Order matches the Flutter provider:
 *   1. object already inline           → use as-is
 *   2. string that matches a fetched model id → use that model
 *   3. string that parses as JSON      → use the parsed object (legacy)
 */
export const resolveFurnitureRef = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const model = getFurnitureModelById(trimmed);
  if (model) return model;

  try {
    const decoded = JSON.parse(trimmed);
    return decoded && typeof decoded === "object" ? decoded : null;
  } catch {
    return null;
  }
};
