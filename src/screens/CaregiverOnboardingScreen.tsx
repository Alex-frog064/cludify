import { useState } from 'react';
import { Image, KeyboardAvoidingView, KeyboardTypeOptions, Pressable, Platform, ScrollView, View, StyleSheet } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../components/LocalizedText';
import * as ImagePicker from 'expo-image-picker';
import { colors , createThemedStyles} from '../theme';
import { getCurrentServiceLocation } from '../utils/currentServiceLocation';
import { CaregiverAvailability, Coordinates, UserAccount } from '../types';
import { useAppSettings } from '../context/AppSettingsContext';
import { showLocalizedAlert } from '../utils/localizedAlert';

type Props = {
  account: UserAccount;
  onCancel: () => void;
  onComplete: (user: UserAccount) => Promise<void> | void;
};

type Draft = {
  identificationNumber: string;
  rfc: string;
  professionalTitle: string;
  serviceLocation: string;
  serviceCoordinates?: Coordinates;
  description: string;
  yearsExperience: string;
  hourlyRate: string;
  specialties: string[];
  availability: CaregiverAvailability;
};

const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const specialtyOptions = [
  'Compañía',
  'Movilidad',
  'Alzheimer',
  'Apoyo en higiene',
  'Medicamentos',
  'Preparación de alimentos',
];

export function CaregiverOnboardingScreen({ account, onCancel, onComplete }: Props) {
  const { language } = useAppSettings();
  const [step, setStep] = useState(account.caregiverSetupDraft ? 1 : 0);
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    identificationNumber: account.caregiverSetupDraft?.identificationNumber ?? '',
    rfc: account.caregiverSetupDraft?.rfc ?? '',
    professionalTitle: account.caregiverSetupDraft?.professionalTitle ?? '',
    serviceLocation: account.caregiverSetupDraft?.serviceLocation ?? '',
    serviceCoordinates: account.caregiverSetupDraft?.serviceCoordinates,
    description: '',
    yearsExperience: '',
    hourlyRate: '',
    specialties: [],
    availability: { days: [], startTime: '08:00', endTime: '17:00' },
  });

  const update = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (pickerError) {
      showLocalizedAlert(
        language,
        'No se pudo abrir la galería',
        pickerError instanceof Error ? pickerError.message : 'Intenta seleccionar tu foto otra vez.',
      );
    }
  };

  const useCurrentLocation = async () => {
    setIsLocating(true);
    setError('');
    try {
      const result = await getCurrentServiceLocation();
      if (!result.granted) {
        setError('Permite el acceso a tu ubicación o escribe tu zona manualmente.');
        return;
      }
      update({ serviceLocation: result.label, serviceCoordinates: result.coordinates });
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? `No se pudo obtener la ubicación: ${locationError.message}`
          : 'No se pudo obtener la ubicación. Escribe tu zona manualmente.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    update({
      specialties: draft.specialties.includes(specialty)
        ? draft.specialties.filter((item) => item !== specialty)
        : [...draft.specialties, specialty],
    });
  };

  const toggleDay = (day: string) => {
    update({
      availability: {
        ...draft.availability,
        days: draft.availability.days.includes(day)
          ? draft.availability.days.filter((item) => item !== day)
          : [...draft.availability.days, day],
      },
    });
  };

  const continueSetup = async () => {
    if (submitting) return;
    setError('');
    if (step === 0) {
      if (!draft.identificationNumber.trim() || !draft.rfc.trim() || !draft.professionalTitle.trim() || !draft.serviceLocation.trim()) {
        setError('Completa tu título, cédula, RFC y zona de servicio.');
        return;
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      const yearsExperience = Number(draft.yearsExperience);
      const hourlyRate = Number(draft.hourlyRate);
      if (!draft.description.trim() || !draft.yearsExperience || !draft.hourlyRate) {
        setError('Comparte tu experiencia, tarifa y una breve descripción.');
        return;
      }
      if (Number.isNaN(yearsExperience) || Number.isNaN(hourlyRate) || yearsExperience < 0 || hourlyRate <= 0) {
        setError('Revisa los años de experiencia y la tarifa por hora.');
        return;
      }
      if (!draft.specialties.length) {
        setError('Selecciona al menos una especialidad.');
        return;
      }
      setStep(2);
      return;
    }

    if (!draft.availability.days.length) {
      setError('Selecciona al menos un día de disponibilidad.');
      return;
    }
    if (!isValidTimeRange(draft.availability.startTime, draft.availability.endTime)) {
      setError('Ingresa un horario válido, por ejemplo de 08:00 a 17:00.');
      return;
    }

    setSubmitting(true);
    try {
      await onComplete({
        ...account,
        profilePhotoUri: photoUri,
        caregiverSetupDraft: undefined,
        caregiverProfile: {
          identificationNumber: draft.identificationNumber.trim(),
          rfc: draft.rfc.trim().toUpperCase(),
          professionalTitle: draft.professionalTitle.trim(),
          serviceLocation: draft.serviceLocation.trim(),
          serviceCoordinates: draft.serviceCoordinates,
          description: draft.description.trim(),
          yearsExperience: Number(draft.yearsExperience),
          hourlyRate: Number(draft.hourlyRate),
          specialties: draft.specialties,
          availability: draft.availability,
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      keyboardVerticalOffset={0}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable accessibilityLabel={step === 0 ? 'Salir del registro' : 'Paso anterior'} onPress={step === 0 ? onCancel : () => setStep(step - 1)} style={styles.backButton}>
          <Text style={styles.backText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Perfil de cuidador</Text>
        <Text style={styles.stepCount}>{step + 1} de 3</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / 3) * 100}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {step === 0 && (
          <>
            <Text style={styles.eyebrow}>PRESENTACIÓN</Text>
            <Text style={styles.title}>Tu perfil, tu historia</Text>
            <Text style={styles.subtitle}>Cuéntales a las familias quién eres y cómo pueden reconocerte.</Text>

            <Pressable accessibilityRole="button" onPress={pickPhoto} style={styles.photoPicker}>
              {photoUri ? (
                <Image resizeMode="cover" source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}><Text style={styles.photoIcon}>＋</Text></View>
              )}
              <View style={styles.photoCopy}>
                <Text style={styles.photoTitle}>{photoUri ? 'Cambiar foto de perfil' : 'Agrega una foto de perfil'}</Text>
                <Text style={styles.fieldHint}>Una foto clara genera confianza · opcional</Text>
              </View>
              <Text style={styles.photoArrow}>›</Text>
            </Pressable>

            <Field
              label="Título profesional"
              onChangeText={(value) => update({ professionalTitle: value })}
              placeholder="Ej. Cuidadora de personas mayores"
              value={draft.professionalTitle}
            />
            <Field
              label="Zona donde ofreces cuidados"
              onChangeText={(value) => update({ serviceLocation: value, serviceCoordinates: undefined })}
              placeholder="Ej. Del Valle, Benito Juárez, CDMX"
              value={draft.serviceLocation}
            />
            <Pressable disabled={isLocating} onPress={useCurrentLocation} style={styles.locationButton}>
              <Text style={styles.locationButtonText}>
                {isLocating ? 'Buscando ubicación…' : '⌖  Usar mi ubicación actual'}
              </Text>
            </Pressable>
            <Field
              label="Cédula profesional"
              onChangeText={(value) => update({ identificationNumber: value })}
              placeholder="Número de cédula"
              value={draft.identificationNumber}
            />
            <Field
              autoCapitalize="characters"
              label="RFC"
              onChangeText={(value) => update({ rfc: value })}
              placeholder="Ej. XAXX010101000"
              value={draft.rfc}
            />
            <View style={styles.notice}>
              <Text style={styles.noticeIcon}>ⓘ</Text>
              <Text style={styles.noticeText}>La cédula y el RFC son datos de demostración. En esta versión no se envían ni se verifican.</Text>
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.eyebrow}>EXPERIENCIA</Text>
            <Text style={styles.title}>¿Cómo puedes ayudar?</Text>
            <Text style={styles.subtitle}>Comparte tu experiencia y los servicios que ofreces.</Text>

            <View style={styles.row}>
              <Field
                keyboardType="number-pad"
                label="Años de experiencia"
                onChangeText={(value) => update({ yearsExperience: value })}
                placeholder="Ej. 5"
                value={draft.yearsExperience}
                wrapperStyle={styles.halfField}
              />
              <Field
                keyboardType="decimal-pad"
                label="Tarifa por hora (MXN)"
                onChangeText={(value) => update({ hourlyRate: value })}
                placeholder="Ej. 180"
                value={draft.hourlyRate}
                wrapperStyle={styles.halfField}
              />
            </View>
            <Field
              label="Cuéntanos sobre ti"
              multiline
              onChangeText={(value) => update({ description: value })}
              placeholder="Describe tu experiencia y cómo acompañas a las personas mayores."
              value={draft.description}
              wrapperStyle={styles.descriptionField}
            />

            <Text style={styles.label}>Tus especialidades</Text>
            <Text style={styles.fieldHint}>Selecciona todas las que correspondan.</Text>
            <View style={styles.chipList}>
              {specialtyOptions.map((specialty) => {
                const selected = draft.specialties.includes(specialty);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={specialty}
                    onPress={() => toggleSpecialty(specialty)}
                    style={[styles.chip, selected && styles.selectedChip]}
                  >
                    <Text style={[styles.chipText, selected && styles.selectedChipText]}>
                      {selected ? '• ' : '+ '}{specialty}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.eyebrow}>DISPONIBILIDAD</Text>
            <Text style={styles.title}>¿Cuándo estás disponible?</Text>
            <Text style={styles.subtitle}>Las familias podrán encontrar horarios que se ajusten a ti.</Text>

            <Text style={styles.label}>Días disponibles</Text>
            <View style={styles.dayList}>
              {days.map((day) => {
                const selected = draft.availability.days.includes(day);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={day}
                    onPress={() => toggleDay(day)}
                    style={[styles.dayChip, selected && styles.selectedDayChip]}
                  >
                    <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.scheduleLabel]}>Horario habitual</Text>
            <View style={styles.row}>
              <Field
                keyboardType="numbers-and-punctuation"
                label="Desde"
                onChangeText={(value) => update({ availability: { ...draft.availability, startTime: value } })}
                placeholder="08:00"
                value={draft.availability.startTime}
                wrapperStyle={styles.halfField}
              />
              <Field
                keyboardType="numbers-and-punctuation"
                label="Hasta"
                onChangeText={(value) => update({ availability: { ...draft.availability, endTime: value } })}
                placeholder="17:00"
                value={draft.availability.endTime}
                wrapperStyle={styles.halfField}
              />
            </View>
            <View style={styles.notice}>
              <Text style={styles.noticeIcon}>ⓘ</Text>
              <Text style={styles.noticeText}>Podrás actualizar tus días y horarios cuando quieras.</Text>
            </View>
          </>
        )}

        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>Tu información no se guarda ni se comparte.</Text>
        <Pressable disabled={submitting} onPress={() => void continueSetup()} style={[styles.continueButton, submitting && { opacity: 0.7 }]}>
          <Text style={styles.continueText}>{submitting ? 'Guardando...' : step === 2 ? 'Crear perfil' : 'Continuar'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function isValidTimeRange(start: string, end: string) {
  const toMinutes = (value: string) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;
}

function Field({
  autoCapitalize,
  keyboardType = 'default',
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
  wrapperStyle,
}: {
  autoCapitalize?: 'none' | 'sentences' | 'characters';
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
  wrapperStyle?: object;
}) {
  return (
    <View style={[styles.field, wrapperStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.line}
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  scrollView: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surface, flexDirection: 'row', height: 54, justifyContent: 'center' },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', left: 13, position: 'absolute', width: 44 },
  backText: { color: colors.ink, fontSize: 31, lineHeight: 34, marginTop: -4 },
  headerTitle: { color: colors.tealDark, fontSize: 14, fontWeight: '800' },
  stepCount: { color: colors.muted, fontSize: 10, position: 'absolute', right: 18 },
  progressTrack: { backgroundColor: colors.line, height: 3 },
  progressFill: { backgroundColor: colors.teal, height: 3 },
  content: { paddingHorizontal: 22, paddingTop: 25, paddingBottom: 22 },
  eyebrow: { color: colors.tealDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.tealDark, fontSize: 23, fontWeight: '800', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 21, marginTop: 6 },
  photoPicker: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginBottom: 19, padding: 12 },
  photoPlaceholder: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 29, height: 58, justifyContent: 'center', width: 58 },
  photo: { backgroundColor: colors.tealPale, borderRadius: 29, height: 58, width: 58 },
  photoIcon: { color: colors.tealDark, fontSize: 25, fontWeight: '400' },
  photoCopy: { flex: 1, marginLeft: 12 },
  photoTitle: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
  photoArrow: { color: colors.tealDark, fontSize: 24, marginHorizontal: 4 },
  locationButton: { alignSelf: 'flex-start', backgroundColor: colors.tealPale, borderRadius: 10, marginBottom: 13, marginTop: -7, paddingHorizontal: 11, paddingVertical: 9 },
  locationButtonText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  field: { marginBottom: 15 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  fieldHint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 12, height: 47, paddingHorizontal: 13 },
  multilineInput: { height: 102, paddingTop: 12, textAlignVertical: 'top' },
  notice: { alignItems: 'flex-start', backgroundColor: colors.tealPale, borderRadius: 11, flexDirection: 'row', marginTop: 2, padding: 11 },
  noticeIcon: { color: colors.tealDark, fontSize: 14, marginRight: 7 },
  noticeText: { color: colors.muted, flex: 1, fontSize: 10, lineHeight: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfField: { flex: 1, marginRight: 8 },
  descriptionField: { marginTop: 1 },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 },
  chip: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginBottom: 8, marginRight: 7, paddingHorizontal: 11, paddingVertical: 9 },
  selectedChip: { backgroundColor: colors.tealPale, borderColor: colors.tealDark },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  selectedChipText: { color: colors.tealDark },
  dayList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  dayChip: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 13, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  selectedDayChip: { backgroundColor: colors.teal, borderColor: colors.tealDark },
  dayText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  selectedDayText: { color: colors.white },
  scheduleLabel: { marginTop: 23 },
  error: { color: colors.tealDark, fontSize: 11, lineHeight: 16, marginTop: 6 },
  footer: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  footerNote: { color: colors.muted, fontSize: 9, marginBottom: 9, textAlign: 'center' },
  continueButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 15, paddingVertical: 14 },
  continueText: { color: colors.white, fontSize: 13, fontWeight: '800' },
}));
