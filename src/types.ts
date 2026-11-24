export type Caregiver = {
  id: string;
  name: string;
  title: string;
  location: string;
  distance: string;
  rating: string;
  reviews: number;
  yearsExperience: number;
  families: number;
  hourlyRate: number;
  availability: string;
  availabilityTone?: 'green' | 'amber';
  image: string;
  verified: boolean;
  about: string;
  specialties: string[];
};

export type AccountRole = 'family' | 'caregiver';

export type CaregiverAvailability = {
  days: string[];
  startTime: string;
  endTime: string;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type MapMarker = {
  id: string;
  label: string;
  rate: string;
  latitude: number;
  longitude: number;
  title?: string;
  location?: string;
};

export type CaregiverRegistration = {
  apiId?: number;
  identificationNumber: string;
  rfc: string;
  professionalTitle: string;
  serviceLocation: string;
  serviceCoordinates?: Coordinates;
  description: string;
  yearsExperience: number;
  hourlyRate: number;
  specialties: string[];
  availability: CaregiverAvailability;
  disponible?: boolean;
  verificado?: boolean;
};

export type CaregiverSetupDraft = Pick<
  CaregiverRegistration,
  'identificationNumber' | 'rfc' | 'professionalTitle' | 'serviceLocation' | 'serviceCoordinates'
>;

export type Medication = {
  id: string;
  apiId?: number;
  name: string;
  dosage: string;
  schedule: string;
};

export type Geofence = {
  id?: number;
  abuelo_id?: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  activo: boolean;
  calle?: string;
  colonia?: string;
  codigoPostal?: string;
  ciudad?: string;
  estado?: string;
};

export type CareRecipient = {
  id: string;
  apiId?: number;
  name: string;
  birthDate: string;
  conditions: string;
  notes: string;
  medications: Medication[];
  geofence?: Geofence;
};

export type ServicioEstado = 'activo' | 'completado' | 'cancelado' | string;
export type ServicioEstadoPago = 'pendiente' | 'pagado' | string;

export type Servicio = {
  id: number;
  abuelo_id: number;
  cuidador_id: number;
  nota: string;
  inicio: string;
  fin: string;
  tarifa_hora: number;
  total: number;
  comision: number;
  estado: ServicioEstado;
  estado_pago: ServicioEstadoPago;
  abuelo_nombre?: string;
  cuidador_nombre?: string;
  aceptado_por_familiar?: boolean | null;
  aceptado_por_cuidador?: boolean | null;
  aceptado_familiar_en?: string | null;
  aceptado_cuidador_en?: string | null;
  creado_en?: string | null;
};

export type Disponibilidad = {
  id: number;
  cuidador_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
};

export type UserAccount = {
  id?: number;
  token?: string;
  name: string;
  email: string;
  phone: string;
  role: AccountRole;
  profilePhotoUri?: string;
  caregiverProfile?: CaregiverRegistration;
  caregiverSetupDraft?: CaregiverSetupDraft;
  careRecipients?: CareRecipient[];
};

export type ConsultaCuidador = {
  consulta_id: number;
  familiar_id?: number;
  cuidador_id: number;
  creado_en?: string;
  actualizado_en?: string;
  no_leidos?: number | null;
  familiar?: { id: number; nombre: string; rol?: string };
  cuidador?: {
    cuidador_id: number;
    nombre: string;
    titulo?: string | null;
    descripcion?: string | null;
    especialidades?: string | null;
    tarifa_hora?: number | null;
    anios_experiencia?: number | null;
    rol?: string;
  };
};

export type MensajeConsulta = {
  id: number;
  consulta_id: number;
  emisor_id: number;
  contenido: string;
  creado_en: string;
  leido_en?: string | null;
  emisor?: { id: number; nombre: string; rol?: string };
};

export type Abuelo = {
  id: number;
  familiar_id: number;
  nombre: string;
  nacimiento?: string | null;
  condiciones?: string | null;
  notas?: string | null;
};

export type Ubicacion = {
  id: number;
  abuelo_id?: number | null;
  cuidador_id?: number | null;
  latitud: number;
  longitud: number;
  velocidad?: number | null;
  direccion_grados?: number | null;
  precision_metros?: number | null;
  bateria?: number | null;
  fecha: string;
  direccion_formateada?: string | null;
};
