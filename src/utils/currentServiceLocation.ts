import * as Location from 'expo-location';
import { Coordinates } from '../types';

type CurrentServiceLocation =
  | { granted: false }
  | { granted: true; label: string; coordinates: Coordinates };

export async function getCurrentServiceLocation(): Promise<CurrentServiceLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { granted: false };

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const coordinates = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
  const [address] = await Location.reverseGeocodeAsync(coordinates);
  const neighborhood = address?.district ?? address?.subregion ?? address?.city;
  const city = address?.city ?? address?.region;
  const label = [neighborhood, city]
    .filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index)
    .join(', ');

  return {
    granted: true,
    label: label || `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
    coordinates,
  };
}
