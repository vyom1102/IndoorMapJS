
export const parseNode = (key) => {
  const [lng, lat, floor] = key.split(",");

  return {
    lng: parseFloat(lng),
    lat: parseFloat(lat),
    floor: parseInt(floor || 0),
    key,
  };
};

// ─────────────────────────────────────────────────────────────
// HAVERSINE DISTANCE
// ─────────────────────────────────────────────────────────────
export const haversineDistance = (
  lat1,
  lon1,
  lat2,
  lon2
) => {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
};

// ─────────────────────────────────────────────────────────────
// DISTANCE
// ─────────────────────────────────────────────────────────────
export const distance = (
  a,
  b,
  mode = "3d"
) => {
  const horizontalDistance =
    haversineDistance(
      a.lat,
      a.lng,
      b.lat,
      b.lng
    );

  if (mode === "3d") {
    const floorPenalty =
      Math.abs(
        (a.floor || 0) -
          (b.floor || 0)
      ) * 12;

    return (
      horizontalDistance + floorPenalty
    );
  }

  return horizontalDistance;
};

// ─────────────────────────────────────────────────────────────
// FIND CLOSEST NODE
// ─────────────────────────────────────────────────────────────
export const findClosestNode = (
  graph,
  point,
  allowedFloors = null
) => {
  let best = null;
  let min = Infinity;

  Object.keys(graph).forEach((k) => {
    const node = parseNode(k);

    if (
      allowedFloors &&
      !allowedFloors.includes(
        node.floor
      )
    ) {
      return;
    }

    const d = distance(node, point);

    if (d < min) {
      min = d;
      best = node;
    }
  });

  return best;
};

// ─────────────────────────────────────────────────────────────
// DIJKSTRA
// ─────────────────────────────────────────────────────────────
export const dijkstra = (
  graph,
  start,
  end,
  mode = "3d",
  selectedNodes = [],
  unselectedNodes = [],
  liftNodes = [],
  stairsNodes = [],
  escalatorNodes = [],
  rampNodes = [],
  nodePenalty = {}
) => {
  const dist = {};
  const prev = {};
  const visited = new Set();

  Object.keys(graph).forEach((k) => {
    dist[k] = Infinity;
  });

  dist[start] = 0;

  while (true) {
    let curr = null;
    let min = Infinity;

    Object.keys(dist).forEach((k) => {
      if (
        !visited.has(k) &&
        dist[k] < min
      ) {
        min = dist[k];
        curr = k;
      }
    });

    if (!curr) break;

    if (curr === end) break;

    visited.add(curr);

    const neighbours =
      graph[curr] || [];

    for (const n of neighbours) {
      if (
        visited.has(n)
      ) {
        continue;
      }

      // blocked nodes
      if (
        unselectedNodes.includes(n)
      ) {
        continue;
      }

      const currNode =
        parseNode(curr);

      const nextNode =
        parseNode(n);

      const isFloorTransition =
        currNode.floor !==
        nextNode.floor;

      // floor-changing node filtering
      if (
        isFloorTransition &&
        selectedNodes.length > 0 &&
        !selectedNodes.includes(curr) &&
        !selectedNodes.includes(n)
      ) {
        continue;
      }

      let weight = distance(
        currNode,
        nextNode,
        mode
      );

      // penalties
      if (nodePenalty[n]) {
        weight += nodePenalty[n];
      }

      // lift preference
      if (
        liftNodes.includes(n)
      ) {
        weight *= 0.8;
      }

      // escalator preference
      if (
        escalatorNodes.includes(n)
      ) {
        weight *= 0.85;
      }

      // ramp preference
      if (
        rampNodes.includes(n)
      ) {
        weight *= 0.9;
      }

      // stairs slightly costly
      if (
        stairsNodes.includes(n)
      ) {
        weight *= 1.1;
      }

      const alt =
        dist[curr] + weight;

      if (alt < dist[n]) {
        dist[n] = alt;
        prev[n] = curr;
      }
    }
  }

  // reconstruct path
  const path = [];

  let step = end;

  while (step) {
    path.unshift(step);
    step = prev[step];
  }

  // invalid path
  if (
    path.length === 1 &&
    path[0] !== start
  ) {
    return null;
  }

  return path;
};

// ─────────────────────────────────────────────────────────────
// BUILD NODE PENALTY MAP
// ─────────────────────────────────────────────────────────────
export const buildPenaltyMap = (
  previousPaths = []
) => {
  const penalty = {};

  for (const path of previousPaths) {
    for (const node of path) {
      penalty[node] =
        (penalty[node] || 0) + 5;
    }
  }

  return penalty;
};

// ─────────────────────────────────────────────────────────────
// GET ALTERNATIVE ROUTES
// ─────────────────────────────────────────────────────────────
export const getAlternativeRoutes = (
  graph,
  start,
  end,
  maxRoutes = 3
) => {
  const routes = [];
  const collectedPaths = [];

  for (
    let i = 0;
    i < maxRoutes;
    i++
  ) {
    const nodePenalty =
      buildPenaltyMap(
        collectedPaths
      );

    const path = dijkstra(
      graph,
      start,
      end,
      "3d",
      [],
      [],
      [],
      [],
      [],
      [],
      nodePenalty
    );

    if (
      !path ||
      !path.length
    ) {
      break;
    }

    collectedPaths.push(path);
    routes.push(path);
  }

  return routes;
};