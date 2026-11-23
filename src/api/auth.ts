const API_BASE = 'https://qualify-mo00.onrender.com/api';

export type RegisterPayload = {
  rol: 'familiar' | 'cuidador';
  nombre: string;
  correo: string;
  telefono: string;
  password: string;
};

export type LoginPayload = {
  correo: string;
  password: string;
};

export type UpdateUsuarioPayload = {
  rol?: 'familiar' | 'cuidador';
  nombre?: string;
  correo?: string;
  telefono?: string;
  password?: string;
};

export type AbueloPayload = {
  familiar_id: number;
  nombre: string;
  nacimiento: string;
  condiciones: string;
  notas: string;
};

export type MedicinaPayload = {
  abuelo_id: number;
  nombre: string;
  dosis: string;
  horario: string;
};

export type CuidadorPayload = {
  usuario_id: number;
  cedula: string;
  titulo: string;
  rfc: string;
  verificado?: boolean;
  descripcion: string;
  anios_experiencia: number;
  tarifa_hora: number;
  especialidades: string;
};

export type CuidadorUpdatePayload = Omit<CuidadorPayload, 'usuario_id'>;

export type GeocercaPayload = {
  abuelo_id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  activo: boolean;
};

export type ServicioPayload = {
  abuelo_id: number;
  cuidador_id: number;
  nota: string;
  inicio: string;
  fin: string;
  tarifa_hora: number;
  total: number;
  comision: number;
  estado: string;
  estado_pago: string;
};

export type DisponibilidadPayload = {
  cuidador_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
};

async function parseResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown) {
  if (data && typeof data === 'object' && ('message' in data || 'error' in data || 'mensaje' in data)) {
    const record = data as Record<string, unknown>;
    return String(record.message || record.error || record.mensaje);
  }
  return 'No se pudo completar la solicitud.';
}

async function request<T>(path: string, body: unknown, token?: string, method = 'POST'): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(data));
    }
    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
    }
    if (e instanceof TypeError) {
      throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export function registerUser(payload: RegisterPayload) {
  return request<unknown>('/usuarios', payload);
}

export function loginUser(payload: LoginPayload) {
  return request<unknown>('/auth/login', payload);
}

export function updateUsuario(id: number, payload: UpdateUsuarioPayload, token?: string) {
  return request<Record<string, unknown>>(`/usuarios/${id}`, payload, token, 'PUT');
}

export function deleteUsuario(id: number, token?: string) {
  return request<Record<string, unknown>>(`/usuarios/${id}`, undefined, token, 'DELETE');
}

export function createAbuelo(payload: AbueloPayload, token?: string) {
  return request<Record<string, unknown>>('/abuelos', payload, token);
}

export async function getAbuelos(token?: string) {
  const response = await fetch(`${API_BASE}/abuelos`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export function updateAbuelo(id: number, payload: AbueloPayload, token?: string) {
  return request<Record<string, unknown>>(`/abuelos/${id}`, payload, token, 'PUT');
}

export function deleteAbuelo(id: number, token?: string) {
  return request<Record<string, unknown>>(`/abuelos/${id}`, undefined, token, 'DELETE');
}

export async function getMedicinas(token?: string) {
  const response = await fetch(`${API_BASE}/medicinas`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(getErrorMessage(data));
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export function createMedicina(payload: MedicinaPayload, token?: string) {
  return request<Record<string, unknown>>('/medicinas', payload, token);
}

export function updateMedicina(id: number, payload: MedicinaPayload, token?: string) {
  return request<Record<string, unknown>>(`/medicinas/${id}`, payload, token, 'PUT');
}

export function deleteMedicina(id: number, token?: string) {
  return request<Record<string, unknown>>(`/medicinas/${id}`, undefined, token, 'DELETE');
}

export async function getCuidadores(token?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE}/cuidadores`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(data));
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
    if (e instanceof TypeError) throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export function createCuidador(payload: CuidadorPayload, token?: string) {
  return request<Record<string, unknown>>('/cuidadores', payload, token);
}

export function updateCuidador(id: number, payload: CuidadorUpdatePayload, token?: string) {
  return request<Record<string, unknown>>(`/cuidadores/${id}`, payload, token, 'PUT');
}

export function deleteCuidador(id: number, token?: string) {
  return request<Record<string, unknown>>(`/cuidadores/${id}`, undefined, token, 'DELETE');
}

export function updateCuidadorDisponible(id: number, disponible: boolean, token?: string) {
  return request<Record<string, unknown>>(`/cuidadores/${id}/disponible`, { disponible }, token, 'PUT');
}

export function updateCuidadorUbicacion(
  id: number,
  payload: { latitud: number; longitud: number; precision_metros?: number },
  token?: string,
) {
  return request<Record<string, unknown>>(`/cuidadores/${id}/ubicacion`, payload, token, 'PUT');
}

export async function getCuidadoresMapa(token?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE}/cuidadores/mapa`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(data));
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
    if (e instanceof TypeError) throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function subirDocumentosVerificacion(
  cuidadorId: number,
  ine: { uri: string; name: string; type: string },
  selfie: { uri: string; name: string; type: string },
  token?: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const form = new FormData();
  form.append('cuidador_id', String(cuidadorId));
  form.append('archivo_ine', ine as unknown as Blob);
  form.append('archivo_selfie', selfie as unknown as Blob);
  try {
    const response = await fetch(`${API_BASE}/verificacion/subir-documentos`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
      signal: controller.signal,
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(data));
    return data as Record<string, unknown>;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
    if (e instanceof TypeError) throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getGeocercas(token?: string) {
  const response = await fetch(`${API_BASE}/geocercas`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(getErrorMessage(data));
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export function createGeocerca(payload: GeocercaPayload, token?: string) {
  return request<Record<string, unknown>>('/geocercas', payload, token);
}

export function updateGeocerca(id: number, payload: GeocercaPayload, token?: string) {
  return request<Record<string, unknown>>(`/geocercas/${id}`, payload, token, 'PUT');
}

export function deleteGeocerca(id: number, token?: string) {
  return request<Record<string, unknown>>(`/geocercas/${id}`, undefined, token, 'DELETE');
}

export async function getServicios(token?: string) {
  const response = await fetch(`${API_BASE}/servicios`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(getErrorMessage(data));
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export function createServicio(payload: ServicioPayload, token?: string) {
  return request<Record<string, unknown>>('/servicios', payload, token);
}

export function updateServicio(id: number, payload: ServicioPayload, token?: string) {
  return request<Record<string, unknown>>(`/servicios/${id}`, payload, token, 'PUT');
}

export function deleteServicio(id: number, token?: string) {
  return request<Record<string, unknown>>(`/servicios/${id}`, undefined, token, 'DELETE');
}

export async function getDisponibilidad(token?: string) {
  const response = await fetch(`${API_BASE}/disponibilidad`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(getErrorMessage(data));
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export function createDisponibilidad(payload: DisponibilidadPayload, token?: string) {
  return request<Record<string, unknown>>('/disponibilidad', payload, token);
}

export function updateDisponibilidad(id: number, payload: DisponibilidadPayload, token?: string) {
  return request<Record<string, unknown>>(`/disponibilidad/${id}`, payload, token, 'PUT');
}

export function deleteDisponibilidad(id: number, token?: string) {
  return request<Record<string, unknown>>(`/disponibilidad/${id}`, undefined, token, 'DELETE');
}
