import axios from "axios";

const baseUrl = import.meta.env.VITE_BASE_URL;
const apiKey = import.meta.env.VITE_API_KEY;

export const loadVenueData = async (venueName) => {
  try {
    const res = await axios.post(
      `${baseUrl}/secured/building/get/venue?api_key=${apiKey}`,
      {
        venueName,
        campusIncludes: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = res.data;

    const campus = data?.campus;
    const source =
      campus?.coordinates != null
        ? campus
        : data?.buildings?.[0];

    if (!source) return null;

    return {
      name:
        source.venueName ||
        source.buildingName ||
        "Unknown Venue",
      lat: source.coordinates[0],
      lng: source.coordinates[1],
      floors: campus?.totalFloors || [0],
    };
  } catch (e) {
    console.error("Venue load error", e);
    return null;
  }
};