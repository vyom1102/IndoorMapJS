export const parseNode = (key) => {
  const [lng, lat, floor] = key.split(",");
  return {
    lng: parseFloat(lng),
    lat: parseFloat(lat),
    floor: parseInt(floor),
    key,
  };
};

const distance = (a, b) => {
  const dx = a.lng - b.lng;
  const dy = a.lat - b.lat;
  return Math.sqrt(dx * dx + dy * dy) * 111000;
};

export const findClosestNode = (graph, point) => {
  let best = null;
  let min = Infinity;

  Object.keys(graph).forEach((k) => {
    const node = parseNode(k);
    const d = distance(node, point);

    if (d < min) {
      min = d;
      best = node;
    }
  });

  return best;
};

export const dijkstra = (graph, start, end) => {
  const dist = {};
  const prev = {};
  const visited = new Set();

  Object.keys(graph).forEach((k) => (dist[k] = Infinity));
  dist[start] = 0;

  while (true) {
    let curr = null;
    let min = Infinity;

    Object.keys(dist).forEach((k) => {
      if (!visited.has(k) && dist[k] < min) {
        min = dist[k];
        curr = k;
      }
    });

    if (!curr) break;
    if (curr === end) break;

    visited.add(curr);

    (graph[curr] || []).forEach((n) => {
      const d =
        dist[curr] +
        distance(parseNode(curr), parseNode(n));

      if (d < dist[n]) {
        dist[n] = d;
        prev[n] = curr;
      }
    });
  }

  const path = [];
  let step = end;

  while (step) {
    path.unshift(step);
    step = prev[step];
  }

  return path;
};