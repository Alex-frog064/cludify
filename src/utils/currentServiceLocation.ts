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
    label: label || 'Ubicación actual',
    coordinates,
  };
}

export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

export function distanceInKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export type AddressSuggestion = {
  label: string;
  coordinates: Coordinates;
  calle?: string;
  colonia?: string;
  codigoPostal?: string;
  ciudad?: string;
  estado?: string;
};

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const suggestions = await searchAddressSuggestions({ query: address });
  return suggestions[0]?.coordinates ?? null;
}

export async function searchAddressSuggestions(input: {
  query?: string;
  calle?: string;
  colonia?: string;
  codigoPostal?: string;
  ciudad?: string;
  estado?: string;
}): Promise<AddressSuggestion[]> {
  const calle = input.calle?.trim();
  const colonia = input.colonia?.trim();
  const codigoPostal = input.codigoPostal?.trim();
  const ciudad = input.ciudad?.trim();
  const estado = input.estado?.trim();

  const queries = [
    input.query?.trim(),
    [calle, colonia, codigoPostal, ciudad, estado, 'México'].filter(Boolean).join(', '),
    [calle, colonia, ciudad, estado, 'México'].filter(Boolean).join(', '),
    [colonia, codigoPostal, ciudad, estado, 'México'].filter(Boolean).join(', '),
    [calle, ciudad, estado, 'México'].filter(Boolean).join(', '),
    [colonia, ciudad, estado, 'México'].filter(Boolean).join(', '),
  ].filter((q, i, arr): q is string => !!q && arr.indexOf(q) === i);

  const seen = new Set<string>();
  const results: AddressSuggestion[] = [];

  for (const q of queries) {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      countrycodes: 'mx',
      q,
    });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { Accept: 'application/json', 'Accept-Language': 'es', 'User-Agent': 'Qualify-App/1.0' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const data = (await response.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: Record<string, string>;
      }>;
      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if (!item.lat || !item.lon) continue;
        const key = `${item.lat},${item.lon},${item.display_name ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = item.address ?? {};
        results.push({
          label: item.display_name || q,
          coordinates: { latitude: Number(item.lat), longitude: Number(item.lon) },
          calle: [a.road, a.house_number].filter(Boolean).join(' ') || calle,
          colonia: a.neighbourhood || a.suburb || a.quarter || a.hamlet || colonia,
          codigoPostal: a.postcode || codigoPostal,
          ciudad: a.city || a.town || a.village || a.municipality || a.county || ciudad,
          estado: a.state || estado,
        });
        if (results.length >= 6) return results;
      }
    } catch {
      // try next query
    }
  }

  return results;
}

