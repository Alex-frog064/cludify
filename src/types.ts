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
};

export type CaregiverRegistration = {
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
};

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  schedule: string;
};

export type CareRecipient = {
  id: string;
  name: string;
  birthDate: string;
  conditions: string;
  notes: string;
  medications: Medication[];
};

export type UserAccount = {
  name: string;
  email: string;
  phone: string;
  role: AccountRole;
  profilePhotoUri?: string;
  caregiverProfile?: CaregiverRegistration;
  careRecipients?: CareRecipient[];
};
