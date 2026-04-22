export const splitFeatures = (features) => {
  const rooms = [];
  const boundaries = [];
  const animals = [];
  const sections = [];

  for (const f of features) {
    const p = f.properties || {};
    if (f.geometry?.type === "LineString") continue;

    if (p.type === "Waypoint") continue;
    if (p.type === "Boundary" || p.polygonType === "Boundary") {
      boundaries.push(f);
    } else if (p.type === "Section") {
      sections.push(f); // 🔥 NEW
    } else if (p.animalRef) {
      animals.push(f);
    } else {
      rooms.push(f);
    }
  }

  return { rooms, boundaries, animals, sections };
};