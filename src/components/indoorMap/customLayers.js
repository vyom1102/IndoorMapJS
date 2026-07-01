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
