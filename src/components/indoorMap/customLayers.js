import maplibregl from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import { BOUNDARY_LOGO_SIZE_M } from "./constants";

/**
 * Mercator origin for a layer, plus the matrix that shifts back to it.
 *
 * Mercator coordinates are ~0.7 while a metre is ~1e-8 of them. Put that
 * offset in an object's model matrix and the shader does the arithmetic in
 * float32, which has nowhere near the digits for it — geometry z-fights and
 * flickers. So the shared offset is folded into the projection matrix on the
 * CPU (float64) each frame, and object matrices only ever carry small,
 * origin-relative values.
 */
const layerOrigin = (points) => {
  const first = points[0];
  const origin = first
    ? { x: first.x, y: first.y, z: first.z }
    : { x: 0, y: 0, z: 0 };
  return {
    origin,
    matrix: new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z),
  };
};

export const buildLogoPlaneLayer = (map, layerId, planes) => {
  map.addLayer({
    id: layerId,
    type: "custom",
    renderingMode: "3d",
    onAdd: function (_map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({
        canvas: _map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;

      // One mesh per plane (geometry shared) so the whole layer is a single
      // draw pass instead of one full scene render per logo.
      this.geometry = new THREE.PlaneGeometry(1, 1);
      this.rotationX = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(1, 0, 0),
        Math.PI
      );
      this.rotationZ = new THREE.Matrix4();

      const mercators = planes.map(({ center, z }) =>
        maplibregl.MercatorCoordinate.fromLngLat(
          { lng: center[0], lat: center[1] },
          z
        )
      );
      const { origin, matrix: originMatrix } = layerOrigin(mercators);
      this.originMatrix = originMatrix;

      this.planes = planes.map(({ texture, scaleX, scaleY, rot }, index) => {
        const mercator = mercators[index];
        const meterScale = mercator.meterInMercatorCoordinateUnits();
        const mesh = new THREE.Mesh(
          this.geometry,
          new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          })
        );
        // Matrices are driven by hand below; frustum culling can't be trusted
        // once the camera's projection carries the whole mercator transform.
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = false;
        this.scene.add(mesh);

        return {
          mesh,
          tx: mercator.x - origin.x,
          ty: mercator.y - origin.y,
          tz: mercator.z - origin.z,
          rot: rot || 0,
          scaleVec: new THREE.Vector3(meterScale * scaleX, meterScale * scaleY, 1),
        };
      });
    },
    render: function (_gl, matrix) {
      this.renderer.state.reset();
      this.renderer.clearDepth();

      const normalizedBearing = ((map.getBearing() % 360) + 360) % 360;

      this.planes.forEach((plane) => {
        const planeDeg = ((plane.rot * 180) / Math.PI + 360) % 360;
        let delta = normalizedBearing - planeDeg;
        delta = ((delta + 540) % 360) - 180;

        // Flip the logo when the camera swings behind it so it never reads
        // mirrored — bearing-dependent, hence recomputed each frame.
        const finalRotation = plane.rot + (Math.abs(delta) > 90 ? Math.PI : 0);
        this.rotationZ.makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          finalRotation
        );

        plane.mesh.matrix
          .makeTranslation(plane.tx, plane.ty, plane.tz)
          .multiply(this.rotationZ)
          .multiply(this.rotationX)
          .scale(plane.scaleVec);
        plane.mesh.matrixWorldNeedsUpdate = true;
      });

      this.camera.projectionMatrix.fromArray(matrix).multiply(this.originMatrix);
      this.renderer.render(this.scene, this.camera);
    },
    onRemove: function () {
      this.geometry?.dispose?.();
      this.planes?.forEach((plane) => plane.mesh.material?.dispose?.());
      this.renderer?.dispose?.();
    },
  });
};

/**
 * Draw each placement with its matrix folded into the camera's projection.
 *
 * The obvious alternative — put the placement matrix on the object and draw
 * the whole scene once — is wrong twice over: the mercator offset would be
 * evaluated in float32 by the shader (z-fighting), and three flips face
 * culling for the negative-determinant Y-mirror when it sits in matrixWorld,
 * which turns the models inside out. So: one pass per placement, matrices
 * multiplied on the CPU in float64.
 */
const renderPlacements = function (matrix) {
  this.renderer.state.reset();
  this.base.fromArray(matrix);

  this.placements.forEach((placement) => {
    if (!placement.model) return;
    placement.model.visible = true;
    this.camera.projectionMatrix.multiplyMatrices(this.base, placement.matrix);
    this.renderer.render(this.scene, this.camera);
    placement.model.visible = false;
  });
};

const fitGltfToFootprint = (object, footprint) => {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const scaleX = footprint.widthM / Math.max(size.x, 0.001);
  const scaleY = footprint.heightM / Math.max(size.y, 0.001);
  const scaleZ = footprint.lengthM / Math.max(size.z, 0.001);
  object.scale.set(scaleX, scaleY, scaleZ);
  object.position.set(
    -center.x * scaleX,
    -box.min.y * scaleY,
    -center.z * scaleZ
  );
};

/**
 * Load a GLB once per URL for the lifetime of the page.
 *
 * The same model is placed by several layers (one per floor and per feature
 * type) and every floor switch tears those layers down and rebuilds them, so
 * without this the same file is re-downloaded and re-decoded constantly.
 * Clones share the cached geometry and materials — which is why the layer must
 * not dispose them on removal.
 */
const gltfCache = new Map();

const loadGltf = (url) => {
  if (!gltfCache.has(url)) {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    loader.setDRACOLoader(dracoLoader);

    gltfCache.set(
      url,
      new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      })
        .finally(() => dracoLoader.dispose())
        // Don't cache a failure — the next layer should get another attempt.
        .catch((error) => {
          gltfCache.delete(url);
          throw error;
        })
    );
  }
  return gltfCache.get(url);
};

export const buildGltfModelLayer = (map, layerId, modelUrl, placements) => {
  map.addLayer({
    id: layerId,
    type: "custom",
    renderingMode: "3d",
    onAdd: function (_map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({
        canvas: _map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(0, -70, 100).normalize();
      this.scene.add(ambientLight, directionalLight);

      this.base = new THREE.Matrix4();

      this.placements = placements.map((placement) => {
        const mercator = maplibregl.MercatorCoordinate.fromLngLat(
          { lng: placement.center[0], lat: placement.center[1] },
          placement.z
        );
        const translate = new THREE.Matrix4().makeTranslation(
          mercator.x,
          mercator.y,
          mercator.z
        );
        const rotateZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          (placement.rot || 0) + (placement.rotationOffsetRad || 0)
        );
        const rotateX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          Math.PI / 2
        );
        const uprightRoll = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          placement.uprightRollRad || 0
        );
        const scale = mercator.meterInMercatorCoordinateUnits();
        const scaleMatrix = new THREE.Matrix4().makeScale(scale, -scale, scale);

        return {
          matrix: translate
            .multiply(rotateZ)
            .multiply(rotateX)
            .multiply(uprightRoll)
            .multiply(scaleMatrix),
          footprint: placement.footprint,
        };
      });

      this.removed = false;
      loadGltf(modelUrl)
        .then((gltf) => {
          if (this.removed) return;
          this.placements.forEach((placement) => {
            const model = gltf.scene.clone(true);
            fitGltfToFootprint(model, placement.footprint);
            model.visible = false;
            placement.model = model;
            this.scene.add(model);
          });
          map.triggerRepaint();
        })
        .catch((error) => {
          console.error(`Failed to load GLB model: ${modelUrl}`, error);
        });
    },
    render: function (_gl, matrix) {
      renderPlacements.call(this, matrix);
    },
    onRemove: function () {
      // Geometry/materials belong to the cached GLB and are shared with every
      // other placement of it, so only the renderer is ours to dispose.
      this.removed = true;
      this.renderer?.dispose?.();
    },
  });
};

// Radial segment count for round primitives. The Flutter side has no real
// curved geometry — fill-extrusion only extrudes flat polygons — so cylinders
// there are faked from a box footprint. WebGL has actual revolved geometry, so
// round shapes here are built properly rather than mirroring that workaround.
const CYLINDER_RADIAL_SEGMENTS = 48;
const SPHERE_SEGMENTS = 32;

// Radius for a round primitive. `r` is what the 3D-model API sends; w/d are
// only consulted for older inline models that predate it.
const getRadius = (prim) => prim.r ?? (prim.w ?? 1) / 2;

// Build a THREE.Group from a `3dRef.3d` primitive list
// (Y-up metres: w/h/d sizes, ox/oy/oz offsets, optional rx/ry/rz degrees).
const buildPrimitiveGroup = (primitives) => {
  const group = new THREE.Group();

  for (const prim of primitives || []) {
    let geometry;
    // Round primitives may be given an elliptical cross-section via w/d
    // alongside r; applied as a post-build scale since the geometries
    // themselves are circular.
    let ellipseScale = null;

    switch (prim.shape) {
      case "cylinder":
      case "tube": {
        // A cylinder may taper: `rTop`/`rBottom` (or `r2` for the far end)
        // override the uniform `r`. Defaults keep both ends equal.
        const radius = getRadius(prim);
        const radiusTop = prim.rTop ?? radius;
        const radiusBottom = prim.rBottom ?? prim.r2 ?? radius;

        geometry = new THREE.CylinderGeometry(
          radiusTop,
          radiusBottom,
          prim.h ?? 1,
          CYLINDER_RADIAL_SEGMENTS,
          1,
          prim.openEnded === true
        );

        // Only treat w/d as an ellipse when an explicit radius was also given
        // — otherwise w/d already produced the radius above.
        if (prim.r != null && prim.w != null && prim.d != null) {
          const diameter = radius * 2;
          ellipseScale = [prim.w / diameter, 1, prim.d / diameter];
        }
        break;
      }
      case "cone": {
        const radius = getRadius(prim);
        geometry = new THREE.ConeGeometry(
          radius,
          prim.h ?? 1,
          CYLINDER_RADIAL_SEGMENTS,
          1,
          prim.openEnded === true
        );
        break;
      }
      case "sphere": {
        const radius = getRadius(prim);
        geometry = new THREE.SphereGeometry(
          radius,
          SPHERE_SEGMENTS,
          SPHERE_SEGMENTS / 2
        );

        // Spheres squash into ellipsoids when w/h/d are supplied.
        if (prim.r != null && (prim.w != null || prim.h != null || prim.d != null)) {
          const diameter = radius * 2;
          ellipseScale = [
            prim.w != null ? prim.w / diameter : 1,
            prim.h != null ? prim.h / diameter : 1,
            prim.d != null ? prim.d / diameter : 1,
          ];
        }
        break;
      }
      case "box":
      default:
        geometry = new THREE.BoxGeometry(
          prim.w ?? 1,
          prim.h ?? 1,
          prim.d ?? 1
        );
        break;
    }

    const material = new THREE.MeshStandardMaterial({
      color: prim.color || "#cccccc",
      roughness: prim.roughness ?? 0.8,
      metalness: prim.metalness ?? 0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(prim.ox || 0, prim.oy || 0, prim.oz || 0);
    if (prim.rx) mesh.rotation.x = THREE.MathUtils.degToRad(prim.rx);
    if (prim.ry) mesh.rotation.y = THREE.MathUtils.degToRad(prim.ry);
    if (prim.rz) mesh.rotation.z = THREE.MathUtils.degToRad(prim.rz);
    if (ellipseScale) mesh.scale.set(...ellipseScale);
    group.add(mesh);
  }

  return group;
};

export const buildPrimitiveModelLayer = (map, layerId, placements) => {
  map.addLayer({
    id: layerId,
    type: "custom",
    renderingMode: "3d",
    onAdd: function (_map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({
        canvas: _map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(0, -70, 100).normalize();
      this.scene.add(ambientLight, directionalLight);

      this.base = new THREE.Matrix4();

      this.placements = placements.map((placement) => {
        const mercator = maplibregl.MercatorCoordinate.fromLngLat(
          { lng: placement.center[0], lat: placement.center[1] },
          placement.z
        );
        const translate = new THREE.Matrix4().makeTranslation(
          mercator.x,
          mercator.y,
          mercator.z
        );
        const rotateZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          placement.rot || 0
        );
        const rotateX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          Math.PI / 2
        );
        const scale = mercator.meterInMercatorCoordinateUnits();
        // -scale on Y mirrors once to cancel the projection matrix's Y-flip,
        // keeping triangle winding correct. It must come BEFORE the rotations
        // in the chain (i.e. applied after them), or it turns the model
        // upside down instead.
        const scaleMatrix = new THREE.Matrix4().makeScale(scale, -scale, scale);

        const model = buildPrimitiveGroup(placement.primitives);
        model.visible = false;
        this.scene.add(model);

        return {
          matrix: translate
            .multiply(scaleMatrix)
            .multiply(rotateZ)
            .multiply(rotateX),
          model,
        };
      });

      map.triggerRepaint();
    },
    render: function (_gl, matrix) {
      renderPlacements.call(this, matrix);
    },
    onRemove: function () {
      this.scene?.traverse?.((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material?.dispose?.());
        } else {
          object.material?.dispose?.();
        }
      });
      this.renderer?.dispose?.();
    },
  });
};

export const computePlaneScale = (widthM, heightM, aspect, coverFraction = 0.65) => {
  const maxWidth  = Math.max(0.3, widthM  * coverFraction);
  const maxHeight = Math.max(0.3, heightM * coverFraction);
  let scaleX, scaleY;
  if (maxWidth / aspect <= maxHeight) {
    scaleX = maxWidth;
    scaleY = maxWidth / aspect;
  } else {
    scaleY = maxHeight;
    scaleX = maxHeight * aspect;
  }
  return {
    scaleX: Math.min(scaleX, maxWidth),
    scaleY: Math.min(scaleY, maxHeight),
  };
};

export const computeFixedPlaneScale = (aspect, sizeM = BOUNDARY_LOGO_SIZE_M) => {
  if (aspect >= 1) {
    return { scaleX: sizeM, scaleY: sizeM / aspect };
  }
  return { scaleX: sizeM * aspect, scaleY: sizeM };
};
