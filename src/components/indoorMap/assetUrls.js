import { baseUrl } from "./constants";

export const getObjectFileUrl = (objectFile) => {
  if (!objectFile) return null;
  if (/^https?:\/\//i.test(objectFile)) return objectFile;
  const cleanBase = String(baseUrl).replace(/\/+$/, "");
  const cleanPath = String(objectFile).replace(/^\/+/, "");
  return `${cleanBase}/uploads/${cleanPath}`;
};

export const getImageFileUrl = (imageFile) => {
  if (!imageFile) return null;
  if (/^https?:\/\//i.test(imageFile)) return imageFile;
  const cleanBase = String(baseUrl).replace(/\/+$/, "");
  const cleanPath = String(imageFile).replace(/^\/+/, "");
  return `${cleanBase}/uploads/${cleanPath}`;
};
