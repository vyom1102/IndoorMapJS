
import axios from "axios";
import { getRuntimeConfig } from "../utils/runtimeConfig";

const { baseUrl, apiKey } = getRuntimeConfig();

export const getGeojsonData = async (venueName) => {
  const res = await axios.get(
    `${baseUrl}/secured/get-indoor-geojson-venue/${venueName}?encryptionVersion=v2&api_key=${apiKey}&expand=-1`
  );
  return { data: res.data };
};
