import { getRuntimeConfig } from "../../utils/runtimeConfig";

const runtimeConfig = getRuntimeConfig();

export const baseUrl = runtimeConfig.baseUrl || "";
export const FIXED_GLB_SIZE_PX = 80;

export const ESCALATOR_MODEL_URL =
  import.meta.env.VITE_ESCALATOR_GLB_URL || "/assets/models/Escalator.glb";
export const ESCALATOR_DOWN_MODEL_URL =
  import.meta.env.VITE_ESCALATOR_DOWN_GLB_URL || "/assets/models/cut_escalator.glb";
export const ESCALATOR_MODEL_LENGTH_M = 4.5;
export const ESCALATOR_MODEL_WIDTH_M = 1.1;
export const ESCALATOR_MODEL_HEIGHT_M = 2.5;
export const ESCALATOR_MODEL_ROTATION_OFFSET_RAD = Math.PI * 1.5;
export const ESCALATOR_MODEL_UPRIGHT_ROLL_RAD = Math.PI;
export const ESCALATOR_DOWN_MODEL_LENGTH_M = 1.1;
export const ESCALATOR_DOWN_MODEL_WIDTH_M = 4.1;
export const ESCALATOR_DOWN_MODEL_HEIGHT_M = 2.0;
export const ESCALATOR_DOWN_MODEL_ROTATION_OFFSET_RAD = Math.PI ;
export const ESCALATOR_DOWN_MODEL_UPRIGHT_ROLL_RAD = Math.PI;

export const SITTING_AREA_MODEL_URL =
  import.meta.env.VITE_SITTING_AREA_GLB_URL || "/assets/models/SittingArea.glb";
export const SITTING_AREA_MODEL_LENGTH_M = 5;
export const SITTING_AREA_MODEL_WIDTH_M = 1.5;
export const SITTING_AREA_MODEL_HEIGHT_M = 0.9;
export const SITTING_AREA_MODEL_ROTATION_OFFSET_RAD = Math.PI * 1.5;
export const SITTING_AREA_MODEL_UPRIGHT_ROLL_RAD = Math.PI;

export const TREE_MODEL_LENGTH_M = 2;
export const TREE_MODEL_WIDTH_M = 2;
export const TREE_MODEL_HEIGHT_M = 6;
export const TREE_MODEL_ROTATION_OFFSET_RAD = 0;
export const TREE_MODEL_UPRIGHT_ROLL_RAD = -Math.PI ;


export const CAR_MODEL_LENGTH_M = 4.2;
export const CAR_MODEL_WIDTH_M = 1.8;
export const CAR_MODEL_HEIGHT_M = 1.5;
export const CAR_MODEL_ROTATION_OFFSET_RAD = 0;
export const CAR_MODEL_UPRIGHT_ROLL_RAD = -Math.PI;

// Approx area (m²) one parked car occupies, used to scale how many cars
// get scattered per parking polygon (rough estimate, includes spacing).
export const CAR_FOOTPRINT_AREA_M2 = 50;
export const CAR_MIN_COUNT = 2;
export const CAR_MAX_COUNT = 12;
// Fixed pixel size (in metres equivalent) for boundary logos
export const BOUNDARY_LOGO_SIZE_M = 20;
