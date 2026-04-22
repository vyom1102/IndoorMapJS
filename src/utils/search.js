
export const filterFeatures = (geo, search) => {
  if(!geo || !search) return [];
  return geo.features.filter(f =>
    (f.properties?.name || "").toLowerCase().includes(search.toLowerCase())
  ).slice(0,10);
};
