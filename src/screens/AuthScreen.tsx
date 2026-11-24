import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenTransition } from '../components/ScreenTransition';
import { getCuidadores, loginUser, registerUser } from '../api/auth';
import { colors } from '../theme';
import { getCurrentServiceLocation } from '../utils/currentServiceLocation';
import { AccountRole, Coordinates, UserAccount } from '../types';

type AuthMode = 'login' | 'signup';
type ValidatedField = 'name' | 'phone' | 'password' | 'identificationNumber' | 'rfc';

const PHONE_MAX_LENGTH = 10;
const LICENSE_MAX_LENGTH = 8;
const RFC_MAX_LENGTH = 13;

type Props = {
  mode: AuthMode;
  onBack: () => void;
  onChangeMode: (mode: AuthMode) => void;
  onComplete: (user: UserAccount) => void;
};

export function AuthScreen({ mode, onBack, onChangeMode, onComplete }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [identificationNumberError, setIdentificationNumberError] = useState('');
  const [rfcError, setRfcError] = useState('');
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [serviceCoordinates, setServiceCoordinates] = useState<Coordinates | undefined>();
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [rfc, setRfc] = useState('');
  const [role, setRole] = useState<AccountRole>('family');
  const [error, setError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const isSignup = mode === 'signup';
  const isCaregiverSignup = isSignup && role === 'caregiver';

  const updateValidatedField = (field: ValidatedField, value: string) => {
    setError('');
    if (field === 'name') {
      const cleaned = value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, '');
      setName(cleaned);
      setNameError(
        value !== cleaned
          ? 'El nombre solo puede incluir letras y espacios.'
          : cleaned.trim()
            ? ''
            : 'Ingresa tu nombre completo.',
      );
      return;
    }

    if (field === 'phone') {
      const digits = value.replace(/\D/g, '');
      setPhone(digits.slice(0, PHONE_MAX_LENGTH));
      setPhoneError(
        /\D/.test(value)
          ? 'El teléfono solo puede incluir dígitos.'
          : digits.length > PHONE_MAX_LENGTH
            ? `El teléfono admite máximo ${PHONE_MAX_LENGTH} dígitos.`
            : digits.length > 0 && digits.length < PHONE_MAX_LENGTH
              ? `Ingresa los ${PHONE_MAX_LENGTH} dígitos del teléfono.`
              : digits.length === 0
                ? 'El teléfono es obligatorio.'
                : '',
      );
      return;
    }

    if (field === 'password') {
      setPassword(value);
      setPasswordError(
        value.length === 0
          ? 'La contraseña es obligatoria.'
          : value.length < 8
            ? 'La contraseña debe tener al menos 8 caracteres.'
            : '',
      );
      return;
    }

    if (field === 'identificationNumber') {
      const digits = value.replace(/\D/g, '');
      setIdentificationNumber(digits.slice(0, LICENSE_MAX_LENGTH));
      setIdentificationNumberError(
        /\D/.test(value)
          ? 'La cédula profesional solo puede incluir dígitos.'
          : digits.length > LICENSE_MAX_LENGTH
            ? `La cédula admite máximo ${LICENSE_MAX_LENGTH} dígitos.`
            : digits.length === 0
              ? 'La cédula profesional es obligatoria.'
              : '',
      );
      return;
    }

    const alphanumeric = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setRfc(alphanumeric.slice(0, RFC_MAX_LENGTH));
    setRfcError(
      /[^a-zA-Z0-9]/.test(value)
        ? 'El RFC solo puede incluir letras y números.'
        : alphanumeric.length > RFC_MAX_LENGTH
          ? `El RFC admite máximo ${RFC_MAX_LENGTH} caracteres.`
          : alphanumeric.length === 0
            ? 'El RFC es obligatorio.'
            : '',
    );
  };

  const submit = async () => {
    const invalidName = isSignup && !name.trim();
    const invalidPhone = isSignup && phone.length !== PHONE_MAX_LENGTH;
    const invalidEmail = !email.trim() || !email.trim().includes('@');
    const invalidPassword = password.length < 8;
    const missingProfessionalTitle = isCaregiverSignup && !professionalTitle.trim();
    const missingServiceLocation = isCaregiverSignup && !serviceLocation.trim();
    const missingLicense = isCaregiverSignup && !identificationNumber.trim();
    const missingRfc = isCaregiverSignup && !rfc.trim();

    setError('');
    if (invalidName) {
      setNameError('Ingresa tu nombre completo.');
    }
    if (invalidPhone) {
      setPhoneError(`El teléfono debe tener exactamente ${PHONE_MAX_LENGTH} dígitos.`);
    }
    if (invalidPassword) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.');
    }
    if (missingLicense) {
      setIdentificationNumberError('La cédula profesional es obligatoria.');
    }
    if (missingRfc) {
      setRfcError('El RFC es obligatorio.');
    }

    if (invalidEmail) {
      setError('Escribe un correo electrónico válido.');
    } else if (missingProfessionalTitle) {
      setError('Escribe tu título profesional.');
    } else if (missingServiceLocation) {
      setError('Escribe la zona donde ofreces cuidados.');
    }

    if (
      invalidName
      || invalidPhone
      || invalidEmail
      || invalidPassword
      || missingProfessionalTitle
      || missingServiceLocation
      || missingLicense
      || missingRfc
    ) return;

    setLoading(true);
    const correo = email.trim().toLowerCase();
    const payloadBase = {
      correo,
      password: password.trim(),
    };

    try {
      const response = isSignup
        ? await registerUser({
            ...payloadBase,
            rol: role === 'caregiver' ? 'cuidador' : 'familiar',
            nombre: name.trim(),
            telefono: phone.trim(),
          })
        : await loginUser(payloadBase);

      const data = (response && typeof response === 'object' ? response : {}) as Record<string, any>;
      const user = (data.usuario ?? data.user ?? data.data ?? data) as Record<string, any>;
      const apiRole = String(user.rol ?? user.role ?? (isSignup ? role : 'family')).toLowerCase();
      const userId = typeof user.id === 'number' ? user.id : typeof data.id === 'number' ? data.id : undefined;
      const token =
        [data.token, data.access_token, data.jwt, data.accessToken, user.token, user.access_token, (data.data as any)?.token]
          .find((v): v is string => typeof v === 'string' && v.length > 0);
      let resolvedRole: AccountRole = isSignup
        ? role
        : apiRole === 'cuidador' || apiRole === 'caregiver'
          ? 'caregiver'
          : 'family';

      let caregiverProfile: UserAccount['caregiverProfile'] | undefined;
      if (userId) {
        try {
          const cuidadores = await getCuidadores(token);
          const found = cuidadores.find((c) => Number(c.usuario_id) === userId);
          if (found) {
            resolvedRole = 'caregiver';
            caregiverProfile = {
              apiId: Number(found.id),
              identificationNumber: String(found.cedula ?? ''),
              rfc: String(found.rfc ?? ''),
              professionalTitle: String(found.titulo ?? ''),
              serviceLocation: '',
              description: String(found.descripcion ?? ''),
              yearsExperience: Number(found.anios_experiencia ?? 0),
              hourlyRate: Number(found.tarifa_hora ?? 0),
              specialties: String(found.especialidades ?? '').split(',').map((x) => x.trim()).filter(Boolean),
              availability: { days: [], startTime: '08:00', endTime: '17:00' },
              disponible: Boolean(found.disponible) && Boolean(found.verificado),
              verificado: Boolean(found.verificado),
            };
          }
        } catch {
          // ignorar: usamos rol devuelto por auth
        }
      }

      onComplete({
        id: userId,
        token,
        name: String(user.nombre ?? user.name ?? (isSignup ? name.trim() : correo.split('@')[0])),
        email: String(user.correo ?? user.email ?? correo),
        phone: String(user.telefono ?? user.phone ?? phone.trim()),
        role: resolvedRole,
        caregiverProfile,
        ...(isCaregiverSignup
          ? {
              caregiverSetupDraft: {
                identificationNumber: identificationNumber.trim(),
                rfc: rfc.trim().toUpperCase(),
                professionalTitle: professionalTitle.trim(),
                serviceLocation: serviceLocation.trim(),
                serviceCoordinates,
              },
            }
          : {}),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo completar la solicitud.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const changeMode = () => {
    setError('');
    setRecoveryMessage('');
    setNameError('');
    setPhoneError('');
    setPasswordError('');
    setIdentificationNumberError('');
    setRfcError('');
    if (!isSignup) setRole('caregiver');
    onChangeMode(isSignup ? 'login' : 'signup');
  };

  const loadCurrentLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const result = await getCurrentServiceLocation();
      if (!result.granted) {
        setError('Permite el acceso a tu ubicación o escribe tu zona manualmente.');
        return;
      }
      setServiceLocation(result.label);
      setServiceCoordinates(result.coordinates);
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? `No se pudo obtener la ubicación: ${locationError.message}`
          : 'No se pudo obtener la ubicación. Escribe tu zona manualmente.',
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <ScreenTransition>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <View style={styles.brandLockup}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>Q</Text></View>
          <Text style={styles.brand}>Qualify</Text>
        </View>
        <Text style={styles.eyebrow}>{isSignup ? 'ÚNETE A QUALIFY' : 'TU ESPACIO DE CONFIANZA'}</Text>
        <Text style={styles.title}>{isSignup ? 'Crea tu cuenta' : 'Qué gusto verte'}</Text>
        <Text style={styles.subtitle}>
          {isSignup
            ? role === 'caregiver'
              ? 'Completa tu cuenta y los datos de tu perfil profesional para continuar.'
              : 'Elige cómo quieres usar Qualify. Podrás completar tu perfil después.'
            : 'Inicia sesión para continuar con tranquilidad.'}
        </Text>

      {isSignup && (
        <>
          <Text style={styles.label}>Quiero registrarme como</Text>
          <View style={styles.roleRow}>
            <RoleOption
              active={role === 'family'}
              description="Busco cuidado para mi familia"
              icon="F"
              label="Familia"
              onPress={() => setRole('family')}
            />
            <RoleOption
              active={role === 'caregiver'}
              description="Quiero ofrecer mis servicios"
              icon="C"
              label="Cuidador"
              onPress={() => setRole('caregiver')}
            />
          </View>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          <Input
            error={nameError}
            label="Nombre completo"
            value={name}
            onChangeText={(value) => updateValidatedField('name', value)}
            placeholder="Tu nombre"
          />
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            label="Correo electrónico"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError('');
            }}
            placeholder="nombre@correo.com"
          />
          <Input
            error={phoneError}
            keyboardType="phone-pad"
            label="Teléfono"
            value={phone}
            onChangeText={(value) => updateValidatedField('phone', value)}
            placeholder="10 dígitos"
          />
          <Input
            error={passwordError}
            label="Contraseña"
            value={password}
            onChangeText={(value) => updateValidatedField('password', value)}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry
          />
          {isCaregiverSignup && (
            <>
              <Text style={styles.sectionTitle}>Perfil Profesional</Text>
              <Input
                label="Título profesional"
                value={professionalTitle}
                onChangeText={(value) => {
                  setProfessionalTitle(value);
                  setError('');
                }}
                placeholder="Ej. Cuidadora de personas mayores"
              />
              <Input
                label="Zona donde ofreces cuidados"
                value={serviceLocation}
                onChangeText={(value) => {
                  setServiceLocation(value);
                  setServiceCoordinates(undefined);
                  setError('');
                }}
                placeholder="Ej. Del Valle, Benito Juárez, CDMX"
              />
              <Pressable
                accessibilityRole="button"
                disabled={locating}
                onPress={() => void loadCurrentLocation()}
                style={[styles.locationButton, locating && styles.primaryButtonDisabled]}
              >
                {locating ? (
                  <ActivityIndicator color={colors.tealDark} size="small" />
                ) : (
                  <Text style={styles.locationButtonText}>Usar mi ubicación actual</Text>
                )}
              </Pressable>
              <Input
                keyboardType="number-pad"
                label="Cédula profesional"
                value={identificationNumber}
                onChangeText={(value) => updateValidatedField('identificationNumber', value)}
                placeholder="Número de cédula"
                error={identificationNumberError}
              />
              <Input
                autoCapitalize="characters"
                error={rfcError}
                label="RFC"
                value={rfc}
                onChangeText={(value) => updateValidatedField('rfc', value)}
                placeholder="Ej. XAXX010101000"
              />
            </>
          )}
        </>
      )}
      {!isSignup && (
        <Input
          autoCapitalize="none"
          keyboardType="email-address"
          label="Correo electrónico"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError('');
          }}
          placeholder="nombre@correo.com"
        />
      )}
      {!isSignup && (
        <Input
          error={passwordError}
          label="Contraseña"
          value={password}
          onChangeText={(value) => updateValidatedField('password', value)}
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
        />
      )}

        {!isSignup && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setRecoveryMessage('La recuperación de contraseña aún no está disponible. Contacta al equipo de soporte para recuperar tu acceso.')}
            style={styles.recoveryLink}
          >
            <Text style={styles.switchLink}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        )}
        {!!recoveryMessage && <Text accessibilityRole="alert" style={styles.recoveryMessage}>{recoveryMessage}</Text>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={loading} onPress={submit} style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>
              {isCaregiverSignup ? 'Continuar con mi perfil' : isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
            </Text>
          )}
        </Pressable>
        <View style={styles.switchLine}>
          <Text style={styles.switchText}>{isSignup ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}</Text>
          <Pressable accessibilityRole="button" onPress={changeMode}>
            <Text style={styles.switchLink}>{isSignup ? ' Inicia sesión' : ' Regístrate como cuidador'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenTransition>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
};

function Input({ label, error, ...inputProps }: InputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={inputProps.autoCapitalize}
        keyboardType={inputProps.keyboardType}
        onChangeText={inputProps.onChangeText}
        placeholder={inputProps.placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={inputProps.secureTextEntry}
        style={styles.input}
        value={inputProps.value}
      />
      {!!error && <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function RoleOption({
  active,
  description,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  description: string;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.roleOption, active && styles.activeRoleOption]}
    >
      <Text style={[styles.roleIcon, active && styles.activeRoleIcon]}>{icon}</Text>
      <Text style={styles.roleLabel}>{label}</Text>
      <Text style={styles.roleDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', backgroundColor: colors.canvas, flexGrow: 1, justifyContent: 'center', maxWidth: 480, paddingHorizontal: 25, paddingVertical: 54, width: '100%' },
  back: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 21, borderWidth: 1, height: 42, justifyContent: 'center', left: 22, position: 'absolute', top: 16, width: 42 },
  backText: { color: colors.ink, fontSize: 32, lineHeight: 36, marginTop: -4 },
  brandLockup: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 35 },
  brandMark: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 13, height: 34, justifyContent: 'center', width: 34 },
  brandMarkText: { color: colors.white, fontSize: 19, fontWeight: '800' },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800', marginLeft: 9 },
  eyebrow: { color: colors.tealDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 27, marginTop: 8, textAlign: 'center' },
  roleRow: { flexDirection: 'row', marginBottom: 18 },
  roleOption: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 13, borderWidth: 1, flex: 1, marginRight: 8, minHeight: 105, paddingHorizontal: 8, paddingVertical: 11 },
  activeRoleOption: { backgroundColor: colors.tealPale, borderColor: colors.tealDark },
  roleIcon: { color: colors.muted, fontSize: 20 },
  activeRoleIcon: { color: colors.tealDark },
  roleLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 4 },
  roleDescription: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4, textAlign: 'center' },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 13, marginTop: 3 },
  inputGroup: { marginBottom: 16 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 14, borderWidth: 1, color: colors.ink, fontSize: 14, height: 52, paddingHorizontal: 15 },
  fieldError: { color: colors.tealDark, fontSize: 11, lineHeight: 15, marginTop: 5 },
  recoveryLink: { alignSelf: 'flex-end', marginBottom: 14, marginTop: -5, paddingVertical: 3 },
  recoveryMessage: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 12 },
  locationButton: { alignSelf: 'flex-start', backgroundColor: colors.tealPale, borderRadius: 10, marginBottom: 15, marginTop: -7, paddingHorizontal: 13, paddingVertical: 11 },
  locationButtonText: { color: colors.tealDark, fontSize: 11, fontWeight: '700' },
  error: { color: colors.tealDark, fontSize: 12, marginBottom: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 14, marginTop: 8, minHeight: 52, justifyContent: 'center', paddingVertical: 14 },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  switchLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 23 },
  switchText: { color: colors.muted, fontSize: 12 },
  switchLink: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
});
