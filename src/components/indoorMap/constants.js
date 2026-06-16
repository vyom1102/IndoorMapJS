export const baseUrl = import.meta.env.VITE_BASE_URL || "";
export const FIXED_GLB_SIZE_PX = 80;

export const ESCALATOR_MODEL_URL =
  import.meta.env.VITE_ESCALATOR_GLB_URL || "/assets/models/Escalator.glb";
export const ESCALATOR_MODEL_LENGTH_M = 4.5;
export const ESCALATOR_MODEL_WIDTH_M = 1.1;
export const ESCALATOR_MODEL_HEIGHT_M = 1.7;
export const ESCALATOR_MODEL_ROTATION_OFFSET_RAD = Math.PI * 1.5;
export const ESCALATOR_MODEL_UPRIGHT_ROLL_RAD = Math.PI;

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


// Fixed pixel size (in metres equivalent) for boundary logos
export const BOUNDARY_LOGO_SIZE_M = 20;
