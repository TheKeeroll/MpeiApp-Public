export type MapCoordinates = {
  lat: number;
  lon: number;
};

/** Default map focus and coarse app-location fallback for ad targeting. */
export const INITIAL_MAP_REGION = {
  lat: 55.754502,
  lon: 37.708299,
  zoom: 17,
  azimuth: 0,
  tilt: 60,
} as const;

export const isValidMapCoordinates = (coordinates: MapCoordinates): boolean => (
  Number.isFinite(coordinates.lat)
  && Number.isFinite(coordinates.lon)
  && coordinates.lat >= -90
  && coordinates.lat <= 90
  && coordinates.lon >= -180
  && coordinates.lon <= 180
);
