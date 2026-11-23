import type { Caregiver, Coordinates } from '../types';
import { distanceInKm } from './currentServiceLocation';

export const nearbyRadiusKm = 10;

export type NearbyCaregiver = Caregiver & {
  lat?: number;
  lng?: number;
  disponible?: boolean;
  distanceKm?: number;
};

export function mapCaregiver(r: Record<string, unknown>): NearbyCaregiver | null {
  const latRaw = r.lat ?? r.latitude ?? r.latitud;
  const lngRaw = r.lng ?? r.longitude ?? r.longitud;
  const lat = latRaw == null ? undefined : Number(latRaw);
  const lng = lngRaw == null ? undefined : Number(lngRaw);
  const disponible = r.disponible == null ? true : Boolean(r.disponible);
  if (!disponible) return null;
  const id = String(r.cuidador_id ?? r.id ?? '');
  const nombre = String(r.nombre ?? r.name ?? 'Cuidador');
  const especialidadesRaw = r.especialidades ?? r.specialties ?? '';
  const especialidades = Array.isArray(especialidadesRaw) ? especialidadesRaw.map(String) : String(especialidadesRaw).split(',').map((x) => x.trim()).filter(Boolean);
  return {
    id,
    name: nombre,
    title: String(r.titulo ?? r.title ?? 'Cuidador'),
    location: String(r.ubicacion ?? r.direccion_formateada ?? r.location ?? 'Zona de servicio'),
    distance: 'Cerca de ti',
    rating: '5.0',
    reviews: 0,
    yearsExperience: Number(r.anios_experiencia ?? r.yearsExperience ?? 0),
    families: 0,
    hourlyRate: Number(r.tarifa_hora ?? r.hourlyRate ?? 0),
    availability: 'Disponible',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop&crop=faces',
    verified: Boolean(r.verificado ?? r.verified),
    about: String(r.descripcion ?? r.about ?? ''),
    specialties: especialidades.length ? especialidades : ['Cuidado general'],
    lat, lng, disponible,
  };
}

export function filterNearbyCaregivers(items: NearbyCaregiver[], reference: Coordinates | null): NearbyCaregiver[] {
  if (!reference) return items;
  return items
    .flatMap((caregiver) => {
      if (caregiver.lat == null || caregiver.lng == null) return [];
      const distanceKm = distanceInKm(reference, { latitude: caregiver.lat, longitude: caregiver.lng });
      if (distanceKm > nearbyRadiusKm) return [];
      return [{
        ...caregiver,
        distanceKm,
        distance: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`,
      }];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
