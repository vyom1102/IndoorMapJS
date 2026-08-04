
import axios from "axios";
import { getRuntimeConfig } from "../utils/runtimeConfig";

const { baseUrl, apiKey } = getRuntimeConfig();

// 🔥 how close is "same location" (in degrees)
const THRESHOLD = 0.01; // ~100m

// An empty graph is useless: never serve it from cache, never store it.
const hasNodes = (graph) => !!graph && Object.keys(graph).length > 0;

// 🔥 helper to find nearby cached graph
const getCachedGraph = (lat, lng) => {
  const cache = JSON.parse(localStorage.getItem("graphCache") || "[]");

  for (const item of cache) {
    const dLat = Math.abs(item.lat - lat);
    const dLng = Math.abs(item.lng - lng);

    if (dLat < THRESHOLD && dLng < THRESHOLD && hasNodes(item.graph)) {
      console.log("✅ using cached graph");
      return item.graph;
    }
  }

  return null;
};

// 🔥 save graph to cache
const saveGraph = (lat, lng, graph) => {
  if (!hasNodes(graph)) return;

  const cache = JSON.parse(localStorage.getItem("graphCache") || "[]");

  cache.push({
    lat,
    lng,
    graph,
  });

  // optional: limit cache size
  if (cache.length > 10) cache.shift();

  localStorage.setItem("graphCache", JSON.stringify(cache));
};

export const fetchNearbyNodes = async (lat, lng) => {
  try {
    // ✅ 1. check cache first
    const cached = getCachedGraph(lat, lng);
    if (cached) return cached;

    console.log("🌐 calling API for graph");

    // ✅ 2. call API
    const res = await axios.post(
      `${baseUrl}/secured/nearby-nodes?api_key=${apiKey}`,
      { lat, lng },
      { headers: { "Content-Type": "application/json" } }
    );

    const graph = res.data?.edges;

    if (hasNodes(graph)) {
      // ✅ 3. save in cache
      saveGraph(lat, lng, graph);

      return graph;
    }

    console.warn("Nearby nodes returned an empty graph for", lat, lng);
    return null;
  } catch (e) {
    console.error("Nearby nodes error", e);
    return null;
  }
};