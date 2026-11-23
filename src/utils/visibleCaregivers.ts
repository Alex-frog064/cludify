import { getCuidadores, getCuidadoresMapa, getConsultas, getServicios, getUbicaciones } from '../api/auth';
import { mapCaregiver, type NearbyCaregiver } from './nearbyCaregivers';

function toNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export async function loadVisibleCaregivers(token: string): Promise<NearbyCaregiver[]> {
  const [mapData, cuidadores, ubicaciones, servicios, consultas] = await Promise.all([
    getCuidadoresMapa(token).catch(() => []),
    getCuidadores(token).catch(() => []),
    getUbicaciones(token).catch(() => []),
    getServicios(token).catch(() => []),
    getConsultas(token).catch(() => []),
  ]);

  const busyIds = new Set(
    servicios
      .filter((item) => String(item.estado) === 'activo')
      .map((item) => toNumber(item.cuidador_id))
      .filter((id): id is number => id != null),
  );

  const consultasPorCuidador = new Map<number, Record<string, unknown>>();
  for (const consulta of consultas) {
    const id = toNumber(consulta.cuidador_id ?? toRecord(consulta.cuidador).cuidador_id);
    if (id == null) continue;
    consultasPorCuidador.set(id, toRecord(consulta.cuidador));
  }

  const ubicacionPorCuidador = new Map<number, Record<string, unknown>>();
  for (const item of ubicaciones) {
    const id = toNumber(item.cuidador_id);
    if (id == null) continue;
    const actual = ubicacionPorCuidador.get(id);
    if (!actual || String(item.fecha ?? '') > String(actual.fecha ?? '')) {
      ubicacionPorCuidador.set(id, item);
    }
  }

  const resultado = new Map<string, NearbyCaregiver>();
  for (const item of mapData) {
    const mapped = mapCaregiver(item);
    if (mapped) resultado.set(mapped.id, mapped);
  }

  for (const raw of cuidadores) {
    const id = toNumber(raw.id);
    if (id == null || !raw.verificado || !raw.disponible) continue;
    const key = String(id);
    if (resultado.has(key)) continue;

    const ubicacion = ubicacionPorCuidador.get(id);
    const lat = toNumber(ubicacion?.latitud);
    const lng = toNumber(ubicacion?.longitud);
    if (lat == null || lng == null) continue;

    const info = consultasPorCuidador.get(id) ?? {};
    const mapped = mapCaregiver({
      cuidador_id: id,
      nombre: info.nombre ?? `Cuidador #${id}`,
      titulo: raw.titulo ?? info.titulo,
      descripcion: raw.descripcion ?? info.descripcion,
      especialidades: raw.especialidades ?? info.especialidades,
      tarifa_hora: raw.tarifa_hora ?? info.tarifa_hora,
      anios_experiencia: raw.anios_experiencia ?? info.anios_experiencia,
      verificado: true,
      disponible: true,
      latitud: lat,
      longitud: lng,
      direccion_formateada: ubicacion?.direccion_formateada,
    });
    if (!mapped) continue;

    if (busyIds.has(id)) {
      mapped.availability = 'En servicio';
      mapped.availabilityTone = 'amber';
    }
    resultado.set(key, mapped);
  }

  return [...resultado.values()];
}
