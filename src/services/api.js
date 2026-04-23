
import axios from "axios";
const baseUrl = import.meta.env.VITE_BASE_URL;
const apiKey = import.meta.env.VITE_API_KEY;

export const getGeojsonData = async (venueName) => {
  const res = await axios.get(
    `${baseUrl}/secured/get-indoor-geojson-venue/${venueName}?encryptionVersion=v2&api_key=${apiKey}&expand=-1`
  );
  return { data: res.data };
};
