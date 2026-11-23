import type { Servicio } from '../types';

export type ServicioFilter = 'todos' | 'pendientes' | 'aceptados' | 'completados' | 'cancelados';

export const servicioFilters: { key: ServicioFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'aceptados', label: 'Aceptados' },
  { key: 'completados', label: 'Realizados' },
  { key: 'cancelados', label: 'Cancelados' },
];

export function matchesServicioFilter(servicio: Servicio, filter: ServicioFilter) {
  if (filter === 'todos') return true;
  if (filter === 'pendientes') return servicio.estado === 'activo' && !servicio.aceptado_por_cuidador;
  if (filter === 'aceptados') return servicio.estado === 'activo' && !!servicio.aceptado_por_cuidador;
  return servicio.estado === filter;
}

export function matchesServicioSearch(servicio: Servicio, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return [
    String(servicio.id),
    String(servicio.abuelo_id),
    String(servicio.cuidador_id),
    servicio.abuelo_nombre,
    servicio.cuidador_nombre,
    servicio.nota,
    servicio.estado,
    servicio.estado_pago,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(text);
}

function nestedName(value: unknown, fallbackKey: string) {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const nombre = record.nombre ?? record[fallbackKey];
  return typeof nombre === 'string' && nombre.trim() ? nombre : undefined;
}

export function mapServicio(value: Record<string, unknown>): Servicio {
  const abuelo = value.abuelos;
  const cuidador = value.cuidadores;
  return {
    id: Number(value.id),
    abuelo_id: Number(value.abuelo_id),
    cuidador_id: Number(value.cuidador_id),
    nota: String(value.nota ?? ''),
    inicio: String(value.inicio ?? ''),
    fin: String(value.fin ?? ''),
    tarifa_hora: Number(value.tarifa_hora ?? 0),
    total: Number(value.total ?? 0),
    comision: Number(value.comision ?? 0),
    estado: String(value.estado ?? 'activo'),
    estado_pago: String(value.estado_pago ?? 'pendiente'),
    abuelo_nombre: nestedName(abuelo, 'nombre'),
    cuidador_nombre: nestedName(cuidador, 'nombre'),
    aceptado_por_familiar: value.aceptado_por_familiar == null ? null : Boolean(value.aceptado_por_familiar),
    aceptado_por_cuidador: value.aceptado_por_cuidador == null ? null : Boolean(value.aceptado_por_cuidador),
    aceptado_familiar_en: value.aceptado_familiar_en == null ? null : String(value.aceptado_familiar_en),
    aceptado_cuidador_en: value.aceptado_cuidador_en == null ? null : String(value.aceptado_cuidador_en),
    creado_en: value.creado_en == null ? null : String(value.creado_en),
  };
}
