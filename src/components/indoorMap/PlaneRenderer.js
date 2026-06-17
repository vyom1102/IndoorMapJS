// import * as THREE from "three";
// import {
//   getImageFileUrl,
// } from "./assetUrls";
// import {
//   getPoleOfInaccessibility,
//   getPolygonCenter,
//   getPolygonDimensionsMeters,
//   getPolygonRotationRad,
//   getFeatureTopHeight,
// } from "./geometry";
// import {
//   computeFixedPlaneScale,
//   computePlaneScale,
// } from "./customLayers";

// export const createTextTexture = async (text) => {
//   return await new Promise((resolve) => {
//     const canvas = document.createElement("canvas");
//     canvas.width = 1024;
//     canvas.height = 512;
//     const ctx = canvas.getContext("2d");
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     const safeText = String(text || "").trim();
//     const words = safeText.split(" ");
//     let lines = [];
//     if (words.length <= 1) {
//       lines = [safeText];
//     } else {
//       const mid = Math.ceil(words.length / 2);
//       lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
//     }
//     let fontSize = 170;
//     ctx.textAlign = "center";
//     ctx.textBaseline = "middle";
//     while (fontSize > 40) {
//       ctx.font = `700 ${fontSize}px sans-serif`;
//       const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
//       if (widest < canvas.width * 0.82) break;
//       fontSize -= 8;
//     }
//     ctx.font = `700 ${fontSize}px sans-serif`;
//     ctx.fillStyle = "#000000";
//     ctx.shadowColor = "rgba(255,255,255,0.8)";
//     ctx.shadowBlur = 10;
//     const lineHeight = fontSize * 1.05;
//     const totalHeight = (lines.length - 1) * lineHeight;
//     const startY = canvas.height / 2 - totalHeight / 2;
//     lines.forEach((line, index) => {
//       ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
//     });
//     const texture = new THREE.CanvasTexture(canvas);
//     texture.needsUpdate = true;
//     resolve(texture);
//   });
// };

// export const initializeTextureCache = () => {
//   const textureLoader = new THREE.TextureLoader();
//   textureLoader.setCrossOrigin("anonymous");
//   const textureCache = new Map();
//   const loadTexture = async (url) => {
//     if (textureCache.has(url)) return textureCache.get(url);
//     try {
//       const tex = await textureLoader.loadAsync(url);
//       textureCache.set(url, tex);
//       return tex;
//     } catch {
//       textureCache.set(url, null);
//       return null;
//     }
//   };
//   return { textureCache, loadTexture };
// };

// export const buildPlanesForPolygons = async (
//   logoUrl,
//   polygonIds,
//   polygonLookup,
//   loadTexture,
//   coverFraction = 0.65,
//   baseOffset = 0          // ← NEW
// ) => {
//   const planes = [];
//   const texture = await loadTexture(logoUrl);
//   if (!texture) return planes;

//   const aspect =
//     texture?.image?.width && texture?.image?.height
//       ? texture.image.width / texture.image.height
//       : 1;

//   for (const polyId of polygonIds) {
//     const linkedPolygon = polygonLookup.get(polyId);
//     if (!linkedPolygon) continue;

//     const center = getPoleOfInaccessibility(linkedPolygon.geometry);
//     if (!center) continue;

//     const { widthM, heightM } = getPolygonDimensionsMeters(linkedPolygon.geometry);
//     // Add baseOffset so the plane sits on top of the correctly stacked floor
//     const roofZ = baseOffset + getFeatureTopHeight(linkedPolygon.properties) + 0.06;
//     const { scaleX, scaleY } = computePlaneScale(widthM, heightM, aspect, coverFraction);

//     planes.push({
//       center,
//       texture,
//       scaleX,
//       scaleY,
//       z: roofZ,
//       rot: getPolygonRotationRad(linkedPolygon.geometry),
//     });
//   }
//   return planes;
// };

// export const buildBoundaryLogoPlanes = async (
//   boundaries,
//   loadTexture,
//   BOUNDARY_LOGO_SIZE_M,
//   baseOffset = 0          // ← NEW
// ) => {
//   const planes = [];

//   for (const boundary of boundaries) {
//     const p = boundary.properties || {};
//     const logoUrl = getImageFileUrl(p.imageFile || p.logo || p.logoUrl);
//     if (!logoUrl) continue;

//     const center =
//       getPoleOfInaccessibility(boundary.geometry) ||
//       getPolygonCenter(boundary.geometry);
//     if (!center) continue;

//     const texture = await loadTexture(logoUrl);
//     if (!texture) continue;

//     const aspect =
//       texture?.image?.width && texture?.image?.height
//         ? texture.image.width / texture.image.height
//         : 1;

//     const { scaleX, scaleY } = computeFixedPlaneScale(aspect, BOUNDARY_LOGO_SIZE_M);
//     // Add baseOffset so boundary logo floats above the stacked floor
//     const roofZ = baseOffset + getFeatureTopHeight(p) + 0.06;

//     planes.push({
//       center,
//       texture,
//       scaleX,
//       scaleY,
//       z: roofZ,
//       rot: getPolygonRotationRad(boundary.geometry),
//     });
//   }

//   return planes;
// };

// export const buildSponsorLogoPlanes = async (
//   sponsorPoints,
//   loadTexture,
//   polygonLookup,
//   buildPlanesForPolygonsFunc,
//   baseOffset = 0          // ← NEW
// ) => {
//   const logoPlanes = [];
//   const nameFeatures = [];

//   for (const pointFeature of sponsorPoints) {
//     const p = pointFeature.properties || {};
//     const logo = p.sponsorRef?.logo_url;
//     if (!logo) continue;

//     const polygonIds = [
//       ...(p.associatedPolygons || []),
//       ...(pointFeature.associatedPolygons || []),
//     ].map(String);

//     const sponsorName = p.name || p.sponsorRef?.name || "";
//     let labelPlaced = false;

//     const planes = await buildPlanesForPolygonsFunc(
//       logo,
//       polygonIds,
//       polygonLookup,
//       loadTexture,
//       0.65,
//       baseOffset         // ← pass through
//     );
//     logoPlanes.push(...planes);

//     if (planes.length && !labelPlaced && sponsorName) {
//       const first = planes[0];
//       nameFeatures.push({
//         type: "Feature",
//         geometry: {
//           type: "Point",
//           // Use the already-offset z from the plane itself
//           coordinates: [first.center[0], first.center[1], first.z],
//         },
//         properties: { name: sponsorName },
//       });
//       labelPlaced = true;
//     }

//     if (!labelPlaced && sponsorName) {
//       const fallbackCoords = p.centroid || pointFeature.geometry?.coordinates;
//       if (fallbackCoords) {
//         nameFeatures.push({
//           type: "Feature",
//           geometry: {
//             type: "Point",
//             // Fallback label also lifted by baseOffset
//             coordinates: [fallbackCoords[0], fallbackCoords[1], baseOffset + 3],
//           },
//           properties: { name: sponsorName },
//         });
//       }
//     }
//   }

//   return { logoPlanes, nameFeatures };
// };

// export const buildExhibitorLogoPlanes = async (
//   exhibitorPoints,
//   loadTexture,
//   polygonLookup,
//   buildPlanesForPolygonsFunc,
//   baseOffset = 0          // ← NEW
// ) => {
//   const planes = [];

//   for (const pointFeature of exhibitorPoints) {
//     const p = pointFeature.properties || {};
//     const logo = p.exhibitorRef?.brandingDetails?.companyLogo;
//     if (!logo) continue;

//     const polygonIds = [
//       ...(p.associatedPolygons || []),
//       ...(pointFeature.associatedPolygons || []),
//     ].map(String);

//     const featurePlanes = await buildPlanesForPolygonsFunc(
//       logo,
//       polygonIds,
//       polygonLookup,
//       loadTexture,
//       0.65,
//       baseOffset         // ← pass through
//     );
//     planes.push(...featurePlanes);
//   }

//   return planes;
// };

// export const buildPointImagePlanes = async (
//   imagedPoints,
//   loadTexture,
//   polygonLookup,
//   baseOffset = 0          // ← NEW
// ) => {
//   const planes = [];
//   const usedPolygonIds = new Set();

//   for (const pointFeature of imagedPoints) {
//     const p = pointFeature.properties || {};

//     const type = String(p.type || p.polygonType || "").toLowerCase();

//     // Ignore washrooms only
//     if (type.includes("washroom")) continue;

//     // Keep cafeterias and rooms
//     const shouldShow = type.includes("room") || type.includes("cafeteria");
//     if (!shouldShow) continue;

//     const polygonIds = [
//       ...(p.associatedPolygons || []),
//       ...(pointFeature.associatedPolygons || []),
//     ].map(String);

//     if (!polygonIds.length) continue;

//     let texture = null;
//     const imageUrl = getImageFileUrl(p.imageFile);
//     if (imageUrl) texture = await loadTexture(imageUrl);
//     if (!texture) texture = await createTextTexture(p.name || "Room");
//     if (!texture) continue;

//     const aspect =
//       texture?.image?.width && texture?.image?.height
//         ? texture.image.width / texture.image.height
//         : 2;

//     for (const polyId of polygonIds) {
//       if (usedPolygonIds.has(polyId)) continue;

//       const linkedPolygon = polygonLookup.get(polyId);
//       if (!linkedPolygon) continue;

//       usedPolygonIds.add(polyId);

//       const center =
//         getPoleOfInaccessibility(linkedPolygon.geometry) ||
//         getPolygonCenter(linkedPolygon.geometry);
//       if (!center) continue;

//       const { widthM, heightM } = getPolygonDimensionsMeters(linkedPolygon.geometry);

//       // Add baseOffset so room labels sit on top of the correct stacked floor
//       const roofZ = baseOffset + getFeatureTopHeight(linkedPolygon.properties) + 0.06;

//       const { scaleX, scaleY } = computePlaneScale(widthM, heightM, aspect, 0.7);

//       planes.push({
//         center,
//         texture,
//         scaleX,
//         scaleY,
//         z: roofZ,
//         rot: getPolygonRotationRad(linkedPolygon.geometry),
//       });
//     }
//   }

//   return planes;
// };
import * as THREE from "three";
import {
  getImageFileUrl,
} from "./assetUrls";
import {
  getPoleOfInaccessibility,
  getPolygonCenter,
  getPolygonCenterOfMass,
  getPolygonDimensionsMeters,
  getPolygonRotationRad,
  getFeatureTopHeight,
} from "./geometry";
import {
  computeFixedPlaneScale,
  computePlaneScale,
} from "./customLayers";

export const createTextTexture = async (text) => {
  return await new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const safeText = String(text || "").trim();
    const words = safeText.split(" ");
    let lines = [];
    if (words.length <= 1) {
      lines = [safeText];
    } else {
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    let fontSize = 170;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    while (fontSize > 40) {
      ctx.font = `700 ${fontSize}px sans-serif`;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (widest < canvas.width * 0.82) break;
      fontSize -= 8;
    }
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.fillStyle = "#000000";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 10;
    const lineHeight = fontSize * 1.05;
    const totalHeight = (lines.length - 1) * lineHeight;
    const startY = canvas.height / 2 - totalHeight / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    resolve(texture);
  });
};

export const initializeTextureCache = () => {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin("anonymous");
  const textureCache = new Map();
  const loadTexture = async (url) => {
    if (textureCache.has(url)) return textureCache.get(url);
    try {
      const tex = await textureLoader.loadAsync(url);
      textureCache.set(url, tex);
      return tex;
    } catch {
      textureCache.set(url, null);
      return null;
    }
  };
  return { textureCache, loadTexture };
};

export const buildPlanesForPolygons = async (
  logoUrl,
  polygonIds,
  polygonLookup,
  loadTexture,
  coverFraction = 0.65,
  baseOffset = 0          // ← NEW
) => {
  const planes = [];
  const texture = await loadTexture(logoUrl);
  if (!texture) return planes;

  const aspect =
    texture?.image?.width && texture?.image?.height
      ? texture.image.width / texture.image.height
      : 1;

  for (const polyId of polygonIds) {
    const linkedPolygon = polygonLookup.get(polyId);
    if (!linkedPolygon) continue;

    const center = getPoleOfInaccessibility(linkedPolygon.geometry);
    if (!center) continue;

    const { widthM, heightM } = getPolygonDimensionsMeters(linkedPolygon.geometry);
    // Add baseOffset so the plane sits on top of the correctly stacked floor
    const roofZ = baseOffset + getFeatureTopHeight(linkedPolygon.properties) + 0.06;
    const { scaleX, scaleY } = computePlaneScale(widthM, heightM, aspect, coverFraction);

    planes.push({
      center,
      texture,
      scaleX,
      scaleY,
      z: roofZ,
      rot: getPolygonRotationRad(linkedPolygon.geometry),
    });
  }
  return planes;
};

export const buildBoundaryLogoPlanes = async (
  boundaries,
  loadTexture,
  BOUNDARY_LOGO_SIZE_M,
  baseOffset = 0          // ← NEW
) => {
  const planes = [];

  for (const boundary of boundaries) {
    const p = boundary.properties || {};
    const logoUrl = getImageFileUrl(p.imageFile || p.logo || p.logoUrl);
    if (!logoUrl) continue;

    const center =
      getPoleOfInaccessibility(boundary.geometry) ||
      getPolygonCenter(boundary.geometry);
    if (!center) continue;

    const texture = await loadTexture(logoUrl);
    if (!texture) continue;

    const aspect =
      texture?.image?.width && texture?.image?.height
        ? texture.image.width / texture.image.height
        : 1;

    const { scaleX, scaleY } = computeFixedPlaneScale(aspect, BOUNDARY_LOGO_SIZE_M);
    // Add baseOffset so boundary logo floats above the stacked floor
    const roofZ = baseOffset + getFeatureTopHeight(p) + 0.06;

    planes.push({
      center,
      texture,
      scaleX,
      scaleY,
      z: roofZ,
      rot: getPolygonRotationRad(boundary.geometry),
    });
  }

  return planes;
};

export const buildSponsorLogoPlanes = async (
  sponsorPoints,
  loadTexture,
  polygonLookup,
  buildPlanesForPolygonsFunc,
  baseOffset = 0          // ← NEW
) => {
  const logoPlanes = [];
  const nameFeatures = [];

  for (const pointFeature of sponsorPoints) {
    const p = pointFeature.properties || {};
    const logo = p.sponsorRef?.logo_url;
    if (!logo) continue;

    const polygonIds = [
      ...(p.associatedPolygons || []),
      ...(pointFeature.associatedPolygons || []),
    ].map(String);

    const sponsorName = p.name || p.sponsorRef?.name || "";
    let labelPlaced = false;

    const planes = await buildPlanesForPolygonsFunc(
      logo,
      polygonIds,
      polygonLookup,
      loadTexture,
      0.65,
      baseOffset         // ← pass through
    );
    logoPlanes.push(...planes);

    if (planes.length && !labelPlaced && sponsorName) {
      const first = planes[0];
      nameFeatures.push({
        type: "Feature",
        geometry: {
          type: "Point",
          // Use the already-offset z from the plane itself
          coordinates: [first.center[0], first.center[1], first.z],
        },
        properties: { name: sponsorName },
      });
      labelPlaced = true;
    }

    if (!labelPlaced && sponsorName) {
      const fallbackCoords = p.centroid || pointFeature.geometry?.coordinates;
      if (fallbackCoords) {
        nameFeatures.push({
          type: "Feature",
          geometry: {
            type: "Point",
            // Fallback label also lifted by baseOffset
            coordinates: [fallbackCoords[0], fallbackCoords[1], baseOffset + 3],
          },
          properties: { name: sponsorName },
        });
      }
    }
  }

  return { logoPlanes, nameFeatures };
};

export const buildExhibitorLogoPlanes = async (
  exhibitorPoints,
  loadTexture,
  polygonLookup,
  buildPlanesForPolygonsFunc,
  baseOffset = 0          // ← NEW
) => {
  const planes = [];

  for (const pointFeature of exhibitorPoints) {
    const p = pointFeature.properties || {};
    const logo = p.exhibitorRef?.brandingDetails?.companyLogo;
    if (!logo) continue;

    const polygonIds = [
      ...(p.associatedPolygons || []),
      ...(pointFeature.associatedPolygons || []),
    ].map(String);

    const featurePlanes = await buildPlanesForPolygonsFunc(
      logo,
      polygonIds,
      polygonLookup,
      loadTexture,
      0.65,
      baseOffset         // ← pass through
    );
    planes.push(...featurePlanes);
  }

  return planes;
};
const getRoomPlaneCenter = (geometry, { isTextTexture }) => {
  if (isTextTexture) {
    return (
      getPolygonCenterOfMass(geometry) ||
      getPoleOfInaccessibility(geometry) ||
      getPolygonCenter(geometry)
    );
  }

  return (
    getPoleOfInaccessibility(geometry) ||
    getPolygonCenter(geometry)
  );
};

export const buildPointImagePlanes = async (
  imagedPoints,
  loadTexture,
  polygonLookup,
  baseOffset = 0          // ← NEW
) => {
  const planes = [];
  const usedPolygonIds = new Set();

  for (const pointFeature of imagedPoints) {
    const p = pointFeature.properties || {};

    const type = String(p.type || p.polygonType || "").toLowerCase();

    // Ignore washrooms only
    if (type.includes("washroom")) continue;

    // Keep cafeterias and rooms
    const shouldShow = type.includes("room") || type.includes("cafeteria");
    if (!shouldShow) continue;

    const polygonIds = [
      ...(p.associatedPolygons || []),
      ...(pointFeature.associatedPolygons || []),
    ].map(String);

    if (!polygonIds.length) continue;

    let texture = null;
    let isTextTexture = false;
    const imageUrl = getImageFileUrl(p.imageFile);
    if (imageUrl) texture = await loadTexture(imageUrl);
    if (!texture) {
      texture = await createTextTexture(p.name || "Room");
      isTextTexture = true;
    }
    if (!texture) continue;

    const aspect =
      texture?.image?.width && texture?.image?.height
        ? texture.image.width / texture.image.height
        : 2;

    for (const polyId of polygonIds) {
      if (usedPolygonIds.has(polyId)) continue;

      const linkedPolygon = polygonLookup.get(polyId);
      if (!linkedPolygon) continue;

      usedPolygonIds.add(polyId);

      const center = getRoomPlaneCenter(linkedPolygon.geometry, { isTextTexture });
      if (!center) continue;

      const { widthM, heightM } = getPolygonDimensionsMeters(linkedPolygon.geometry);

      // Add baseOffset so room labels sit on top of the correct stacked floor
      const roofZ = baseOffset + getFeatureTopHeight(linkedPolygon.properties) + 0.06;

      const { scaleX, scaleY } = computePlaneScale(widthM, heightM, aspect, 0.7);

      planes.push({
        center,
        texture,
        scaleX,
        scaleY,
        z: roofZ,
        rot: getPolygonRotationRad(linkedPolygon.geometry),
      });
    }
  }

  return planes;
};