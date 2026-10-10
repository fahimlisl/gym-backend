import { ApiError } from "../utils/ApiError.js";

const toRadians = (value) => {
  return (value * Math.PI) / 180;
};

const calculateDistanceInMeters = (
  lat1,
  lon1,
  lat2,
  lon2
) => {
  const earthRadius = 6371000;

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
};

const parseNumber = (value, fieldName) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new ApiError(
      400,
      `${fieldName} must be a valid number.`
    );
  }

  return number;
};

const getGymLocationConfig = () => {
  const latitude = Number(
    process.env.GYM_LATITUDE
  );

  const longitude = Number(
    process.env.GYM_LONGITUDE
  );

  const radius = Number(
    process.env.GYM_ATTENDANCE_RADIUS_METERS
  );

  const maxAccuracy = Number(
    process.env.GYM_MAX_LOCATION_ACCURACY_METERS
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(maxAccuracy)
  ) {
    throw new ApiError(
      500,
      "Gym location configuration is invalid."
    );
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new ApiError(
      500,
      "Gym coordinates are invalid."
    );
  }

  if (radius <= 0 || maxAccuracy <= 0) {
    throw new ApiError(
      500,
      "Gym location limits are invalid."
    );
  }

  return {
    latitude,
    longitude,
    radius,
    maxAccuracy,
  };
};

export const verifyTrainerLocation = ({
  latitude,
  longitude,
  accuracy,
}) => {
  const trainerLatitude = parseNumber(
    latitude,
    "Latitude"
  );

  const trainerLongitude = parseNumber(
    longitude,
    "Longitude"
  );

  const trainerAccuracy = parseNumber(
    accuracy,
    "Location accuracy"
  );

  if (
    trainerLatitude < -90 ||
    trainerLatitude > 90
  ) {
    throw new ApiError(
      400,
      "Invalid latitude."
    );
  }

  if (
    trainerLongitude < -180 ||
    trainerLongitude > 180
  ) {
    throw new ApiError(
      400,
      "Invalid longitude."
    );
  }

  if (trainerAccuracy <= 0) {
    throw new ApiError(
      400,
      "Invalid location accuracy."
    );
  }

  const gym = getGymLocationConfig();

  if (trainerAccuracy > gym.maxAccuracy) {
    throw new ApiError(
      400,
      "Location accuracy is too low. Please move to an open area and try again."
    );
  }

  const distance = calculateDistanceInMeters(
    trainerLatitude,
    trainerLongitude,
    gym.latitude,
    gym.longitude
  );

  const distanceFromGym = Math.round(
    distance * 100
  ) / 100;

  if (distance > gym.radius) {
    throw new ApiError(
      403,
      "You are outside the allowed gym attendance area."
    );
  }

  return {
    verified: true,
    latitude: trainerLatitude,
    longitude: trainerLongitude,
    accuracy: trainerAccuracy,
    distanceFromGym,
    allowedRadius: gym.radius,
  };
};