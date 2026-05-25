import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import * as THREE from "three";

import { useIndoorMap } from "../hooks/useIndoorMap";
import { splitFeatures } from "../utils/splitFeatures";
import { addPatternImage } from "../utils/patterns";
import {
  BOUNDARY_LOGO_SIZE_M,
  FIXED_GLB_SIZE_PX,
} from "./indoorMap/constants";
import {
  renderDefaultPoiLayer,
  renderAnimalMarkers,
  renderLandmarkGlbObjects,
} from "./indoorMap/LayerRenderer";
import {
  createTextTexture,
  initializeTextureCache,
  buildPlanesForPolygons,
  buildBoundaryLogoPlanes,
  buildSponsorLogoPlanes,
  buildExhibitorLogoPlanes,
  buildPointImagePlanes,
} from "./indoorMap/PlaneRenderer";
import {
  buildEscalatorPlacements,
  buildSittingAreaPlacements,
} from "./indoorMap/ModelRenderer";
import {
  isEscalatorPolygonFeature,
  isSittingAreaPolygonFeature,
} from "./indoorMap/featureTypes";
import {
  getPoleOfInaccessibility,
  getPolygonCenter,
} from "./indoorMap/geometry";
import { getImageFileUrl } from "./indoorMap/assetUrls";
import {
  buildGltfModelLayer,
  buildLogoPlaneLayer,
} from "./indoorMap/customLayers";
import { searchPlaces } from "../utils/SearchEngine";
import {
  selectSource,
  selectDest,
} from "../utils/SelectionHandlers";
import IndoorMapUI from "./IndoorMapUI";

export default function IndoorMap() {
  const renderGenerationRef = useRef(0);

  const {
    mapRef,
    containerRef,
    ready,
    geo,
    setGeo,
    floor,
    setFloor,
    venueData,
    sourceQuery,
    setSourceQuery,
    destQuery,
    setDestQuery,
    sourceResults,
    setSourceResults,
    destResults,
    setDestResults,
    routeRevision,
    markersRef,
    sourceRef,
    destRef,
    customLayerIdsRef,
    routePathRef,
    graphRef,
    sourceFloorRef,
    destFloorRef,
    switchFloor,
    renderRouteForFloor,
    updateMarkerVisibilityForFloor,
    getFeatureRoutingCoordinates,
    handleRouting,
  } = useIndoorMap();

  // Main rendering effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo || !ready) return;

    const renderGeneration = renderGenerationRef.current + 1;
    renderGenerationRef.current = renderGeneration;
    let cancelled = false;
    const zoomHandlers = [];
    const isCurrentRender = () =>
      !cancelled && renderGenerationRef.current === renderGeneration;

    const render = async () => {
      if (!isCurrentRender()) return;

      const renderCurrentRoute = () => {
        if (!isCurrentRender()) return;
        if (routePathRef.current?.length) {
          renderRouteForFloor(routePathRef.current, floor);
        }
      };

      if (map.getLayer("route-line")) {
        map.removeLayer("route-line");
      }
      if (map.getSource("route")) {
        map.removeSource("route");
      }

      // Remove all custom 3D layers
      const allFloors = venueData?.floors || [floor];
      const customLayerPrefixes = [
        "boundary-logo-3d-",
        "sponsor-logo-3d-",
        "exhibitor-logo-3d-",
        "point-image-3d-",
        "escalator-model-3d-",
        "sitting-area-model-3d-",
      ];
      allFloors.forEach((f) => {
        customLayerPrefixes.forEach((prefix) => {
          const id = `${prefix}${f}`;
          if (map.getLayer(id)) map.removeLayer(id);
        });
      });
      customLayerIdsRef.current.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      customLayerIdsRef.current = [];

      const addTrackedLogoLayer = (layerId, planes) => {
        buildLogoPlaneLayer(map, layerId, planes);
        customLayerIdsRef.current.push(layerId);
      };

      const addTrackedGltfLayer = (layerId, modelUrl, placements) => {
        buildGltfModelLayer(map, layerId, modelUrl, placements);
        customLayerIdsRef.current.push(layerId);
      };

      const floorFeatures = geo.features.filter(
        (f) => (f.properties?.floor ?? 0) === floor
      );

      const {
        rooms,
        boundaries,
        animals,
        sections,
        sponsorPoints,
        exhibitorPoints,
      } = splitFeatures(floorFeatures);
      const renderableRooms = rooms.filter(
        (feature) =>
          !isEscalatorPolygonFeature(feature) &&
          !isSittingAreaPolygonFeature(feature)
      );

      const topSections = sections.filter(
        (f) => !f.properties?.subSection && f.properties?.type !== "Sub Section"
      );
      const subSections = sections.filter(
        (f) =>
          f.properties?.subSection || f.properties?.type === "Sub Section"
      );

      const imagedPoints = floorFeatures.filter((f) => {
        const p = f.properties || {};
        return (
          f.geometry?.type === "Point" &&
          !p.sponsorRef &&
          !p.exhibitorRef &&
          !p.animalRef &&
          f.properties?.type !== "Section"
        );
      });

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const layers = map.getStyle()?.layers || [];
      layers.forEach((l) => {
        if (
          l.id.startsWith("floor_") ||
          l.id.startsWith("animal") ||
          l.id.startsWith("sponsor") ||
          l.id.startsWith("exhibitor") ||
          l.id.startsWith("point-image") ||
          l.id.startsWith("boundary-") ||
          l.id.startsWith("section-") ||
          l.id.startsWith("subsection-") ||
          l.id.startsWith("default-poi")
        ) {
          if (map.getLayer(l.id)) map.removeLayer(l.id);
        }
      });

      const sources = map.getStyle()?.sources || {};
      Object.keys(sources).forEach((id) => {
        if (
          id.startsWith("floor_") ||
          id === "animal-source" ||
          id.startsWith("sponsor") ||
          id.startsWith("exhibitor") ||
          id.startsWith("boundary-") ||
          id.startsWith("section-") ||
          id.startsWith("subsection-") ||
          id.startsWith("default-poi")
        ) {
          if (map.getSource(id)) map.removeSource(id);
        }
      });

      // 1. BOUNDARY BASE
      map.addSource(`boundary-base-src-${floor}`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: boundaries },
      });
      map.addLayer({
        id: `boundary-base-${floor}`,
        type: "fill",
        source: `boundary-base-src-${floor}`,
        paint: { "fill-color": "#D4DBDD", "fill-opacity": 1 },
      });

      // 2. ROOMS (3D)
      map.addSource(`floor_${floor}_rooms`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: renderableRooms },
      });
      map.addLayer({
        id: `floor_${floor}_rooms`,
        type: "fill-extrusion",
        source: `floor_${floor}_rooms`,
        minzoom: 16,
        paint: {
          "fill-extrusion-color": [
            "case",
            ["all", ["has", "fillColor"], ["!=", ["get", "fillColor"], "undefined"]],
            ["get", "fillColor"],
            ["==", ["get", "type"], "Accessible Washroom"],
            "#8EDB88",
            ["==", ["get", "type"], "Female Washroom"],
            "#8EDB88",
            ["==", ["get", "type"], "Male Washroom"],
            "#8EDB88",
            ["==", ["get", "type"], "Unisex Washroom"],
            "#8EDB88",
            ["==", ["get", "type"], "Drinking Water"],
            "#0277BD",
            ["==", ["get", "type"], "Food Lounge"],
            "#D84315",
            ["==", ["get", "type"], "Lift"],
            "#013975",
            ["==", ["get", "type"], "Stairs"],
            "#546E7A",
            ["==", ["get", "type"], "Steps"],
            "#B9BBBD",
            ["in", ["get", "type"], ["literal", ["Lab", "room", "Room", "Rooms"]]],
            "#FFC35D",
            ["==", ["get", "type"], "Office"],
            "#A38F9F",
            ["==", ["get", "type"], "Reception"],
            "#1976D2",
            ["==", ["get", "type"], "Booth"],
            "#8AE8F9",
            ["==", ["get", "type"], "Registration Counter"],
            "#7B1FA2",
            ["==", ["get", "type"], "Point of Interest"],
            "#C2185B",
            ["==", ["get", "type"], "Restricted Area"],
            "#BC9F7E",
            ["==", ["get", "type"], "Non Walkable"],
            "#424242",
            [
              "in",
              ["downcase", ["get", "type"]],
              ["literal", ["green area", "green area | pots"]],
            ],
            "#ADFA9E",
            ["==", ["get", "type"], "Wall"],
            "#DCDCDC",
            ["==", ["get", "type"], "Piller"],
            "#5D4037",
            ["==", ["get", "type"], "Terrace"],
            "#00695C",
            "#B9BBBD",
          ],
          "fill-extrusion-height": [
            "case",
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
                  [">", ["to-number", ["get", "height"]], 0],
                ],
                ["to-number", ["get", "height"]],
                3,
              ],
            ],
            ["==", ["get", "type"], "Booth"],
            ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 2],
            [
              "any",
              ["==", ["downcase", ["get", "type"]], "lift"],
              [
                "in",
                ["downcase", ["get", "type"]],
                [
                  "literal",
                  [
                    "cafeteria",
                    "piller",
                    "counter",
                    "security check",
                    "male washroom",
                    "female washroom",
                    "unisex washroom",
                    "drinking water",
                    "accessible washroom",
                  ],
                ],
              ],
            ],
            [
              "+",
              ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
              [
                "case",
                [
                  "all",
                  ["has", "height"],
                  ["!=", ["get", "height"], "undefined"],
                  [">", ["to-number", ["get", "height"]], 0],
                ],
                ["to-number", ["get", "height"]],
                2,
              ],
            ],
            [
              "in",
              ["downcase", ["get", "type"]],
              ["literal", ["green area", "green area | pots"]],
            ],
            ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], 0.2],
            [
              "all",
              ["has", "height"],
              ["!=", ["get", "height"], "undefined"],
              [">", ["to-number", ["get", "height"]], 0],
            ],
            [
              "+",
              ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
              ["to-number", ["get", "height"]],
            ],
            ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0],
          ],
          "fill-extrusion-base": [
            "case",
            ["has", "baseHeight"],
            ["to-number", ["get", "baseHeight"]],
            0,
          ],
          "fill-extrusion-opacity": 1,
        },
      });

      // ESCALATORS
      const escalatorPlacementsByModel = buildEscalatorPlacements(floorFeatures);
      Array.from(escalatorPlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {
        addTrackedGltfLayer(`escalator-model-3d-${floor}-${index}`, modelUrl, placements);
      });

      // SITTING AREAS
      const sittingAreaPlacementsByModel = buildSittingAreaPlacements(floorFeatures);
      Array.from(sittingAreaPlacementsByModel.entries()).forEach(([modelUrl, placements], index) => {
        addTrackedGltfLayer(`sitting-area-model-3d-${floor}-${index}`, modelUrl, placements);
      });

      // 3. SECTIONS (3D)
      map.addSource(`section-src-${floor}`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: topSections },
      });
      map.addLayer({
        id: `floor_${floor}_sections`,
        type: "fill-extrusion",
        source: `section-src-${floor}`,
        minzoom: 16,
        maxzoom: 17,
        paint: {
          "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#ccc"],
          "fill-extrusion-height": [
            "case",
            ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
            ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
            ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 4],
          ],
          "fill-extrusion-base": [
            "case",
            ["has", "baseHeight"],
            ["to-number", ["get", "baseHeight"]],
            0,
          ],
          "fill-extrusion-opacity": 1,
        },
      });

      // 4. SUBSECTIONS (3D)
      map.addSource(`subsection-src-${floor}`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: subSections },
      });
      map.addLayer({
        id: `floor_${floor}_subsections`,
        type: "fill-extrusion",
        source: `subsection-src-${floor}`,
        minzoom: 17,
        maxzoom: 18,
        paint: {
          "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#aaa"],
          "fill-extrusion-height": [
            "case",
            ["all", ["has", "height"], [">", ["to-number", ["get", "height"]], 0]],
            ["+", ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 0], ["to-number", ["get", "height"]]],
            ["case", ["has", "baseHeight"], ["to-number", ["get", "baseHeight"]], 4],
          ],
          "fill-extrusion-base": [
            "case",
            ["has", "baseHeight"],
            ["to-number", ["get", "baseHeight"]],
            0,
          ],
          "fill-extrusion-opacity": 1,
        },
      });

      // PATTERNS
      rooms.forEach((f, i) => {
        if (!f.properties?.pattern) return;
        const pat = addPatternImage(map, f.properties);
        const src = `pattern_${floor}_${i}`;
        map.addSource(src, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [f] },
        });
        map.addLayer({
          id: src,
          type: "fill",
          source: src,
          paint: { "fill-pattern": pat },
        });
      });

      // 5. BOUNDARY LABEL LAYER
      const boundaryLabelFeatures = boundaries
        .filter((f) => f.properties?.name)
        .map((f) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates:
              getPoleOfInaccessibility(f.geometry) ||
              getPolygonCenter(f.geometry),
          },
          properties: { name: f.properties.name },
        }))
        .filter((f) => f.geometry.coordinates);

      map.addSource(`boundary-label-src-${floor}`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: boundaryLabelFeatures },
      });
      map.addLayer({
        id: `boundary-label-${floor}`,
        type: "symbol",
        source: `boundary-label-src-${floor}`,
        minzoom: 15,
        maxzoom: 16,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 14,
          "text-anchor": "center",
          "text-offset": [0, 1.5],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#222",
          "text-halo-color": "#fff",
          "text-halo-width": 1.5,
        },
      });

      renderCurrentRoute();

      // 6. SECTION LABELS + LOGOS
      const sectionImageByPolygon = new Map();
      const sectionCentroidByPolygon = new Map();

      for (const f of floorFeatures) {
        const p = f.properties || {};
        if (f.geometry?.type !== "Point") continue;
        if (!Array.isArray(p.associatedPolygons)) continue;

        const isSection =
          p.type === "Section" &&
          !p.subSection &&
          p.polygonType !== "Sub Section";

        const centroid =
          p.centroid ||
          (f.geometry?.type === "Point" ? f.geometry.coordinates : null);

        for (const polyId of p.associatedPolygons) {
          const key = String(polyId);
          if (isSection) {
            if (p.imageFile) sectionImageByPolygon.set(key, p.imageFile);
            if (centroid) sectionCentroidByPolygon.set(key, centroid);
          } else {
            if (
              p.imageFile &&
              !sectionImageByPolygon.has(key)
            )
              sectionImageByPolygon.set(key, p.imageFile);
            if (
              centroid &&
              !sectionCentroidByPolygon.has(key)
            )
              sectionCentroidByPolygon.set(key, centroid);
          }
        }
      }

      const sectionSymbolFeatures = [];

      for (const section of topSections) {
        const p = section.properties || {};
        const sectionId = String(
          section.id || section._id || p.id || p._id || ""
        );

        const centroidCoords =
          sectionCentroidByPolygon.get(sectionId) || p.centroid || null;

        const center =
          (Array.isArray(centroidCoords) ? centroidCoords : null) ||
          getPoleOfInaccessibility(section.geometry) ||
          getPolygonCenter(section.geometry);

        if (!center || !p.name) continue;

        const rawImageFile =
          p.imageFile ||
          p.logo ||
          p.logoUrl ||
          sectionImageByPolygon.get(sectionId) ||
          "";

        const logoUrl = getImageFileUrl(rawImageFile);
        let iconId = null;

        if (logoUrl) {
          iconId = `section-icon-${logoUrl.split("/").pop().split("?")[0]}`;
          if (!map.hasImage(iconId)) {
            await new Promise((resolve) => {
              map.loadImage(logoUrl, (err, image) => {
                if (!err && image && !map.hasImage(iconId)) {
                  map.addImage(iconId, image);
                }
                resolve();
              });
            });
            if (!isCurrentRender()) return;
          }
        }

        if (!isCurrentRender()) return;
        sectionSymbolFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: { name: p.name, icon: iconId || "" },
        });
      }

      if (sectionSymbolFeatures.length) {
        map.addSource(`section-label-src-${floor}`, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: sectionSymbolFeatures,
          },
        });
        map.addLayer({
          id: `section-label-${floor}`,
          type: "symbol",
          source: `section-label-src-${floor}`,
          minzoom: 16,
          maxzoom: 17,
          layout: {
            "icon-image": ["case", ["!=", ["get", "icon"], ""], ["get", "icon"], ""],
            "icon-size": 0.15,
            "icon-anchor": "center",
            "icon-text-fit": "none",
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-anchor": "left",
            "text-offset": [1.2, 0],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-placement": "point",
          },
          paint: {
            "text-color": "#333",
            "text-halo-color": "#fff",
            "text-halo-width": 1.5,
          },
        });
      }

      // ANIMALS
      if (animals.length) {
        await renderAnimalMarkers(map, animals, markersRef, FIXED_GLB_SIZE_PX);
        if (!isCurrentRender()) return;
      }

      // LANDMARK GLB OBJECTS
      if (!isCurrentRender()) return;
      renderLandmarkGlbObjects(map, floorFeatures, markersRef, FIXED_GLB_SIZE_PX);

      // DEFAULT POI LAYER
      await renderDefaultPoiLayer(map, floorFeatures, floor, isCurrentRender);
      if (!isCurrentRender()) return;

      // TEXTURE + PLANE RENDERING
      const { textureCache, loadTexture } =
        initializeTextureCache();

      const polygonLookup = new Map();
      [...boundaries, ...rooms, ...topSections, ...subSections].forEach((feature) => {
        const keys = [
          feature.id,
          feature._id,
          feature.properties?.id,
          feature.properties?._id,
        ].filter(Boolean);
        keys.forEach((key) =>
          polygonLookup.set(String(key), feature)
        );
      });

      // BOUNDARY LOGOS
      const boundaryLogoPlanes = await buildBoundaryLogoPlanes(
        boundaries,
        loadTexture,
        BOUNDARY_LOGO_SIZE_M
      );
      if (!isCurrentRender()) return;

      if (boundaryLogoPlanes.length) {
        const boundaryLogoLayerId =
          `boundary-logo-3d-${floor}`;
        addTrackedLogoLayer(
          boundaryLogoLayerId,
          boundaryLogoPlanes
        );

        const updateBoundaryLogoVisibility = () => {
          const z = map.getZoom();
          const visible = z >= 15 && z < 16;
          if (map.getLayer(boundaryLogoLayerId)) {
            map.setLayoutProperty(
              boundaryLogoLayerId,
              "visibility",
              visible ? "visible" : "none"
            );
          }
        };
        updateBoundaryLogoVisibility();
        map.on("zoom", updateBoundaryLogoVisibility);
        zoomHandlers.push(updateBoundaryLogoVisibility);
      }

      // SPONSOR LOGOS
      const { logoPlanes: sponsorLogoPlanes } =
        await buildSponsorLogoPlanes(
          sponsorPoints,
          loadTexture,
          polygonLookup,
          buildPlanesForPolygons
        );
      if (!isCurrentRender()) return;

      if (sponsorLogoPlanes.length) {
        addTrackedLogoLayer(
          `sponsor-logo-3d-${floor}`,
          sponsorLogoPlanes
        );
      }

      // EXHIBITOR LOGOS
      const exhibitorLogoPlanes =
        await buildExhibitorLogoPlanes(
          exhibitorPoints,
          loadTexture,
          polygonLookup,
          buildPlanesForPolygons
        );
      if (!isCurrentRender()) return;

      if (exhibitorLogoPlanes.length) {
        addTrackedLogoLayer(
          `exhibitor-logo-3d-${floor}`,
          exhibitorLogoPlanes
        );
      }

      // POINT IMAGE PLANES
      const pointImagePlanes =
        await buildPointImagePlanes(
          imagedPoints,
          loadTexture,
          polygonLookup
        );
      if (!isCurrentRender()) return;

      if (pointImagePlanes.length) {
        addTrackedLogoLayer(
          `point-image-3d-${floor}`,
          pointImagePlanes
        );
      }

      renderCurrentRoute();
      updateMarkerVisibilityForFloor(floor);
    };

    if (!map.isStyleLoaded()) {
      map.once("load", render);
    } else {
      render();
    }

    return () => {
      cancelled = true;
      zoomHandlers.forEach((handler) => {
        map.off("zoom", handler);
      });
    };
  }, [geo, floor, ready, routeRevision]);

  // Click handler
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
      )
        return;
      const coords =
        features[0].geometry?.coordinates?.[0]?.[0] ||
        features[0].geometry?.coordinates;
      if (!coords) return;
      map.flyTo({ center: coords, zoom: 20 });
    };

    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [ready]);

  // Search handlers
  const handleSourceSearch = async (val) => {
    setSourceQuery(val);
    const results = await searchPlaces(val, geo);
    setSourceResults(results);
  };

  const handleDestSearch = async (val) => {
    setDestQuery(val);
    const results = await searchPlaces(val, geo);
    setDestResults(results);
  };

  const handleSelectSource = (item) => {
    selectSource(
      item,
      mapRef,
      sourceRef,
      sourceFloorRef,
      floor,
      switchFloor,
      getFeatureRoutingCoordinates,
      setSourceQuery,
      setSourceResults,
      destRef,
      handleRouting,
      updateMarkerVisibilityForFloor
    );
  };

  const handleSelectDest = (item) => {
    selectDest(
      item,
      mapRef,
      destRef,
      destFloorRef,
      floor,
      switchFloor,
      getFeatureRoutingCoordinates,
      setDestQuery,
      setDestResults,
      sourceRef,
      handleRouting,
      updateMarkerVisibilityForFloor
    );
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <IndoorMapUI
        sourceQuery={sourceQuery}
        destQuery={destQuery}
        sourceResults={sourceResults}
        destResults={destResults}
        venueData={venueData}
        floor={floor}
        onSourceSearch={handleSourceSearch}
        onDestSearch={handleDestSearch}
        onSourceSelect={handleSelectSource}
        onDestSelect={handleSelectDest}
        onFloorSwitch={switchFloor}
        containerRef={containerRef}
      />
    </div>
  );
}
