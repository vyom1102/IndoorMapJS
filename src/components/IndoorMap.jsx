import { useEffect, useState, useRef } from "react";
import maplibregl from "maplibre-gl";

import { useMap } from "../hooks/useMap";
import { getGeojsonData } from "../services/api";
import { splitFeatures } from "../utils/splitFeatures";
import { addPatternImage } from "../utils/patterns";
import { createPillImage } from "../utils/pill";
import { fetchNearbyNodes } from "../services/FetchGraphAPI";
import { dijkstra, findClosestNode } from "../utils/RouteFunctions";
import { useParams } from "react-router-dom";
import { loadVenueData } from "../services/venueApi";
export default function IndoorMap() {
  const { mapRef, containerRef, ready } = useMap();

  const [geo, setGeo] = useState(null);
  const [floor, setFloor] = useState(0);
  const [venueData, setVenueData] = useState(null);
  const markersRef = useRef([]);
  const sourceRef = useRef(null);
  const destRef = useRef(null);
  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

const [sourceResults, setSourceResults] = useState([]);
const [destResults, setDestResults] = useState([]);
  const venueName = "PIECC"; // "NationalZoologicalPark";
  const defaultCenter = venueData
  ? [venueData.lng, venueData.lat]
  : [77.2437, 28.6063];
  useEffect(() => {
  if (!venueName) return;

  const loadVenue = async () => {
    const data = await loadVenueData(venueName);
    if (!data) return;

    setVenueData(data);

    // 🔥 move camera to venue
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: [data.lng, data.lat],
        zoom: 18,
      });
    }

    // 🔥 set floor
    setFloor(data.floors?.[0] || 0);
  };

  loadVenue();
}, [venueName]);
  useEffect(() => {
    getGeojsonData(venueName).then((res) => {
      if (!res?.data) return;

      setGeo({
        type: "FeatureCollection",
        features: res.data.data || res.data.features || [],
      });
    });
  }, []);
  // 🧱 Rendering Logic
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo || !ready) return;

    const render = async () => {
      const floorFeatures = geo.features.filter(
        (f) => (f.properties?.floor ?? 0) === floor
      );

const { rooms, boundaries, animals, sections } =
  splitFeatures(floorFeatures);

      // 🔥 Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // 🔥 CLEAN layers
      const layers = map.getStyle()?.layers || [];
      layers.forEach((l) => {
        if (l.id.startsWith("floor_") || l.id.startsWith("animal")) {
          if (map.getLayer(l.id)) map.removeLayer(l.id);
        }
      });

      const sources = map.getStyle()?.sources || {};
      Object.keys(sources).forEach((id) => {
        if (id.startsWith("floor_") || id === "animal-source") {
          if (map.getSource(id)) map.removeSource(id);
        }
      });

      // 🧱 BOUNDARY
      map.addSource(`floor_${floor}_boundary`, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: boundaries,
        },
      });

      map.addLayer({
        id: `floor_${floor}_boundary`,
        type: "fill",
        source: `floor_${floor}_boundary`,
        paint: {
          "fill-color": "#D4DBDD",
          "fill-opacity": 1,
        },
      });

      // 🧩 SECTIONS (low zoom layer)

      // 🏢 ROOMS (3D)
      map.addSource(`floor_${floor}_rooms`, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: rooms,
        },
      });

      map.addLayer({
  id: `floor_${floor}_rooms`,
  type: "fill-extrusion",
  source: `floor_${floor}_rooms`,

  paint: {
    // 🎨 COLOR LOGIC
    "fill-extrusion-color": [
      "case",

      // custom color
      [
        "all",
        ["has", "fillColor"],
        ["!=", ["get", "fillColor"], "undefined"]
      ],
      ["get", "fillColor"],

      ["==", ["get", "type"], "Accessible Washroom"], "#8EDB88",
      ["==", ["get", "type"], "Female Washroom"], "#8EDB88",
      ["==", ["get", "type"], "Male Washroom"], "#8EDB88",
      ["==", ["get", "type"], "Unisex Washroom"], "#8EDB88",

      ["==", ["get", "type"], "Drinking Water"], "#0277BD",
      ["==", ["get", "type"], "Food Lounge"], "#D84315",
      ["==", ["get", "type"], "Lift"], "#013975",
      ["==", ["get", "type"], "Stairs"], "#546E7A",
      ["==", ["get", "type"], "Steps"], "#B9BBBD",

      ["in", ["get", "type"], ["literal", ["Lab", "room", "Room", "Rooms"]]], "#FFC35D",

      ["==", ["get", "type"], "Office"], "#A38F9F",
      ["==", ["get", "type"], "Reception"], "#1976D2",
      ["==", ["get", "type"], "Booth"], "#8AE8F9",
      ["==", ["get", "type"], "Registration Counter"], "#7B1FA2",
      ["==", ["get", "type"], "Point of Interest"], "#C2185B",
      ["==", ["get", "type"], "Restricted Area"], "#BC9F7E",
      ["==", ["get", "type"], "Non Walkable"], "#424242",

      ["in", ["downcase", ["get", "type"]],
        ["literal", ["green area", "green area | pots"]]], "#ADFA9E",

      ["==", ["get", "type"], "Wall"], "#DCDCDC",
      ["==", ["get", "type"], "Piller"], "#5D4037",
      ["==", ["get", "type"], "Terrace"], "#00695C",

      "#B9BBBD"
    ],

    // 🏗 HEIGHT LOGIC (IDENTICAL TO FLUTTER)
    "fill-extrusion-height": [
      "case",

      // WALL
      ["==", ["downcase", ["get", "type"]], "wall"],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        [
          "case",
          [
            "all",
            ["has", "height"],
            ["!=", ["get", "height"], "undefined"],
            [">", ["to-number", ["get", "height"]], 0]
          ],
          ["to-number", ["get", "height"]],
          4
        ]
      ],

      // BOOTH
      ["==", ["get", "type"], "Booth"],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        2
      ],

      // GREEN AREA
      ["in", ["downcase", ["get", "type"]],
        ["literal", ["green area", "green area | pots"]]],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        0.2
      ],

      // NORMAL HEIGHT
      [
        "all",
        ["has", "height"],
        ["!=", ["get", "height"], "undefined"],
        [">", ["to-number", ["get", "height"]], 0]
      ],
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        ["to-number", ["get", "height"]]
      ],

      // DEFAULT HEIGHT
      [
        "+",
        ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
        3
      ]
    ],

    // 🧱 BASE HEIGHT
    "fill-extrusion-base": [
      "case",
      ["has", "baseHeight"],
      ["to-number", ["get", "baseHeight"]],
      0
    ],

    "fill-extrusion-opacity": 1
  }
});

      map.addSource(`floor_${floor}_sections`, {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: sections,
  },
});

      map.addLayer({
  id: `floor_${floor}_sections`,
  type: "fill-extrusion", // 🔥 3D now
  source: `floor_${floor}_sections`,
  maxzoom: 17,
  paint: {
    "fill-extrusion-color": [
      "coalesce",
      ["get", "fillColor"],
      "#ccc",
    ],

    // 🔥 DEFAULT HEIGHT = 3.1
    "fill-extrusion-height": [
      "coalesce",
      ["to-number", ["get", "height"]],
      3.1
    ],

    "fill-extrusion-opacity": 1,
  },
});
      // 🎨 PATTERNS
      rooms.forEach((f, i) => {
        if (!f.properties?.pattern) return;

        const pat = addPatternImage(map, f.properties);

        const src = `pattern_${floor}_${i}`;

        map.addSource(src, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [f],
          },
        });

        map.addLayer({
          id: src,
          type: "fill",
          source: src,
          paint: {
            "fill-pattern": pat,
          },
        });
      });

      // 🐘 ANIMALS
      const features = [];

      for (const f of animals) {
        const p = f.properties || {};
        const coords =
          p.centroid || f.geometry.coordinates;

        const model = p.animalRef?.model_3d;
        const iconUrl = p.animalRef?.icon;

        // 👉 3D MODEL
        if (model) {
          const el = document.createElement("div");

          el.innerHTML = `
            <model-viewer
              src="${model}"
              autoplay
              camera-controls
              disable-zoom
              style="width:80px;height:80px;"
            ></model-viewer>
          `;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(map);

          markersRef.current.push(marker);
          continue;
        }

        // 👉 ICON fallback
        const iconId = iconUrl
          ? `animal_${iconUrl.split("/").pop()}`
          : "default";

        if (iconUrl && !map.hasImage(iconId)) {
          // const img = await map.loadImage(iconUrl);
          // map.addImage(iconId, img.data);
           new Promise((resolve, reject) => {
  map.loadImage(iconUrl, (err, image) => {
    if (err) return reject(err);

    if (!map.hasImage(iconId)) {
      map.addImage(iconId, image);
    }

    resolve();
  });
});
}

        const pillId = createPillImage(
          map,
          p.name || "Animal"
        );

        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: coords,
          },
          properties: {
            icon: iconId,
            pill: pillId,
          },
        });
      }

      // 🔥 Animal source
      map.addSource("animal-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      });

      // 🐾 Icon layer
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
            13, 0.08,
            15, 0.18,
            17, 0.32,
            19, 0.45,
            21, 0.6,
          ],
          "icon-anchor": "bottom",
        },
      });

      // 🏷️ Label layer
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

    if (!map.isStyleLoaded()) {
      map.once("load", render);
    } else {
      render();
    }
  }, [geo, floor, ready]);


  // 🖱️ Click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const onClick = (e) => {
      const features = map.queryRenderedFeatures(e.point);

      if (!features.length) return;

      const props = features[0].properties || {};

      if (
        props.type === "Boundary" ||
        props.type === "centroid" ||
        props.type === "Waypoint"
      ) return;

      const coords =
        features[0].geometry?.coordinates?.[0]?.[0] ||
        features[0].geometry?.coordinates;

      if (!coords) return;

      map.flyTo({
        center: coords,
        zoom: 20,
      });
    };

    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [ready]);


useEffect(() => {
  const map = mapRef.current;
  if (!map || !ready || !venueData) return;

  if (sourceRef.current || destRef.current) return;

  const center = [venueData.lng, venueData.lat];

  const src = new maplibregl.Marker({
    draggable: true,
    color: "green",
  })
    .setLngLat(center)
    .addTo(map);

  const dest = new maplibregl.Marker({
    draggable: true,
    color: "red",
  })
    .setLngLat([
      center[0] + 0.0003,
      center[1] + 0.0003,
    ])
    .addTo(map);

  sourceRef.current = src;
  destRef.current = dest;

  // 🔥 ATTACH ROUTING HERE (IMPORTANT)
  const run = () => handleRouting();

  src.on("dragend", run);
  dest.on("dragend", run);

}, [ready, venueData]);

const handleRouting = async () => {
  const map = mapRef.current;



  // if (!map || !sourceRef.current || !destRef.current) return;

  const src = sourceRef.current.getLngLat();
  const dest = destRef.current.getLngLat();
  console.log("SRC:", src);
  console.log("DEST:", dest);
  // 🔥 call your API
  const graph = await fetchNearbyNodes(src.lat, src.lng);

  console.log("GRAPH:", graph);
  if (!graph) return;

  const start = findClosestNode(graph, src);
  const end = findClosestNode(graph, dest);

  console.log("START:", start);
  console.log("END:", end);
  const path = dijkstra(graph, start.key, end.key);

   console.log("PATH:", path);
  const coords = path.map((k) => {
    const [lng, lat] = k.split(",");
    return [parseFloat(lng), parseFloat(lat)];
  });

  const routeGeo = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coords,
    },
  };

  // 🔥 draw/update route
  if (map.getSource("route")) {
    map.getSource("route").setData(routeGeo);
  } else {
    map.addSource("route", {
      type: "geojson",
      data: routeGeo,
    });

    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#007AFF",
        "line-width": 5,
      },
    });
  }
};

// const searchPlaces = (query) => {
//   if (!geo || !query) return [];

//   const q = query.toLowerCase();

//   return geo.features
//     .filter((f) => {
//       const name = f.properties?.name || "";
//       return name.toLowerCase().includes(q);
//     })
//     .slice(0, 5);
// };
const searchPlaces = (query) => {
  if (!geo || !query) return [];

  const q = query.toLowerCase();

  const seen = new Set();
  const results = [];

  for (const f of geo.features) {
    const name = f.properties?.name;
    if (!name) continue;

    const lower = name.toLowerCase();

    if (!lower.includes(q)) continue;

    // 🔥 skip duplicates
    if (seen.has(lower)) continue;

    seen.add(lower);
    results.push(f);

    if (results.length >= 5) break;
  }

  return results;
};
const handleSourceSearch = (val) => {
  setSourceQuery(val);
  setSourceResults(searchPlaces(val));
};

const handleDestSearch = (val) => {
  setDestQuery(val);
  setDestResults(searchPlaces(val));
};
const selectSource = (feature) => {
  const coords =
    feature.properties?.centroid ||
    feature.geometry.coordinates;

  if (sourceRef.current) {
    sourceRef.current.setLngLat(coords);
  }

  setSourceQuery(feature.properties?.name || "");
  setSourceResults([]);

  handleRouting();
};
const dropdownStyle = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 6,
  maxHeight: 150,
  overflowY: "auto",
};

const itemStyle = {
  padding: 8,
  cursor: "pointer",
  borderBottom: "1px solid #eee",
};
const selectDest = (feature) => {
  const coords =
    feature.properties?.centroid ||
    feature.geometry.coordinates;

  if (destRef.current) {
    destRef.current.setLngLat(coords);
  }

  setDestQuery(feature.properties?.name || "");
  setDestResults([]);

  handleRouting();
};
return (
  <div style={{ height: "100vh", width: "100%", position: "relative" }}>
    {/* 🔍 SEARCH PANEL */}
<div
  style={{
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 20,
    width: 260,
  }}
>
  {/* SOURCE */}
  <input
    placeholder="Search Source"
    value={sourceQuery}
    onChange={(e) => handleSourceSearch(e.target.value)}
    style={{
      width: "100%",
      padding: 8,
      marginBottom: 6,
      borderRadius: 6,
      border: "1px solid #ccc",
    }}
  />

  {sourceResults.length > 0 && (
    <div style={dropdownStyle}>
      {sourceResults.map((f, i) => (
        <div
          key={i}
          style={itemStyle}
          onClick={() => selectSource(f)}
        >
          {f.properties?.name || "Unnamed"}
        </div>
        
      ))}
    </div>
  )}

  {/* DESTINATION */}
  <input
    placeholder="Search Destination"
    value={destQuery}
    onChange={(e) => handleDestSearch(e.target.value)}
    style={{
      width: "100%",
      padding: 8,
      marginTop: 10,
      borderRadius: 6,
      border: "1px solid #ccc",
    }}
  />

  {destResults.length > 0 && (
    <div style={dropdownStyle}>
      {destResults.map((f, i) => (
        <div
          key={i}
          style={itemStyle}
          onClick={() => selectDest(f)}
        >
          {f.properties?.name || "Unnamed"}
        </div>
      ))}
    </div>
  )}
</div>
    {/* 🏢 FLOOR SWITCHER */}
    {venueData?.floors?.length > 1 && (
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 10,
          background: "#fff",
          borderRadius: 8,
          padding: 8,
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        }}
      >
        {venueData.floors.map((f) => (
          <button
            key={f}
            onClick={() => setFloor(f)}
            style={{
              display: "block",
              margin: "4px 0",
              padding: "6px 10px",
              width: "100%",
              cursor: "pointer",
              borderRadius: 6,
              border: "none",
              background: f === floor ? "#007AFF" : "#eee",
              color: f === floor ? "#fff" : "#000",
              fontWeight: f === floor ? "bold" : "normal",
            }}
          >
            Floor {f}
          </button>
        ))}
      </div>
    )}

    <div ref={containerRef} style={{ height: "100%" }} />
  </div>
);
  // return (
  //   <div style={{ height: "100vh", width: "100%" }}>
  //     <div ref={containerRef} style={{ height: "100%" }} />
  //   </div>
  // );
}