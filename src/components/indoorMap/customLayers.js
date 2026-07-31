import maplibregl from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import { BOUNDARY_LOGO_SIZE_M } from "./constants";

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
      this.mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          side: THREE.DoubleSide,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        })
      );
      this.scene.add(this.mesh);

      this.planes = planes.map(({ center, texture, scaleX, scaleY, z, rot }) => {
        const mercator = maplibregl.MercatorCoordinate.fromLngLat(
          { lng: center[0], lat: center[1] },
          z
        );
        const meterScale = mercator.meterInMercatorCoordinateUnits();
        return {
          texture,
          tx: mercator.x,
          ty: mercator.y,
          tz: mercator.z,
          sx: meterScale * scaleX,
          sy: meterScale * scaleY,
          rot: rot || 0,
        };
      });
    },
    render: function (_gl, matrix) {
      const base = new THREE.Matrix4().fromArray(matrix);
      this.renderer.state.reset();
      this.renderer.clearDepth();

      this.planes.forEach((plane) => {
        this.mesh.material.map = plane.texture;
        this.mesh.material.needsUpdate = true;

        const rotationX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          Math.PI
        );
        const normalizedBearing = ((map.getBearing() % 360) + 360) % 360;
        const planeDeg = (((plane.rot || 0) * 180) / Math.PI + 360) % 360;

        let delta = normalizedBearing - planeDeg;
        delta = ((delta + 540) % 360) - 180;

        const shouldFlip = Math.abs(delta) > 90;
        const finalRotation = (plane.rot || 0) + (shouldFlip ? Math.PI : 0);

        const rotationZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          finalRotation
        );
        const modelMatrix = new THREE.Matrix4()
          .makeTranslation(plane.tx, plane.ty, plane.tz)
          .multiply(rotationZ)
          .multiply(rotationX)
          .scale(new THREE.Vector3(plane.sx, plane.sy, 1));

        this.camera.projectionMatrix = base.clone().multiply(modelMatrix);
        this.renderer.render(this.scene, this.camera);
      });

      map.triggerRepaint();
    },
    onRemove: function () {
      this.mesh?.geometry?.dispose?.();
      this.mesh?.material?.dispose?.();
      this.renderer?.dispose?.();
    },
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

      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(
        "https://www.gstatic.com/draco/v1/decoders/"
      );
      loader.setDRACOLoader(dracoLoader);

      loader.load(
        modelUrl,
        (gltf) => {
          this.placements.forEach((placement) => {
            const model = gltf.scene.clone(true);
            fitGltfToFootprint(model, placement.footprint);
            model.visible = false;
            placement.model = model;
            this.scene.add(model);
          });
          map.triggerRepaint();
          dracoLoader.dispose();
        },
        undefined,
        (error) => {
          console.error(`Failed to load GLB model: ${modelUrl}`, error);
          dracoLoader.dispose();
        }
      );
    },
    render: function (_gl, matrix) {
      const base = new THREE.Matrix4().fromArray(matrix);

      this.renderer.state.reset();

      this.placements.forEach((placement) => {
        if (!placement.model) return;
        placement.model.visible = true;
        this.camera.projectionMatrix = base.clone().multiply(placement.matrix);
        this.renderer.render(this.scene, this.camera);
        placement.model.visible = false;
      });
      map.triggerRepaint();
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
      const base = new THREE.Matrix4().fromArray(matrix);

      this.renderer.state.reset();

      this.placements.forEach((placement) => {
        if (!placement.model) return;
        placement.model.visible = true;
        this.camera.projectionMatrix = base.clone().multiply(placement.matrix);
        this.renderer.render(this.scene, this.camera);
        placement.model.visible = false;
      });
      map.triggerRepaint();
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
