import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getCuidadores, loginUser, registerUser } from '../api/auth';
import { colors } from '../theme';
import { AccountRole, UserAccount } from '../types';

type AuthMode = 'login' | 'signup';

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
  const [role, setRole] = useState<AccountRole>('family');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';

  const submit = async () => {
    if (isSignup && (!name.trim() || !phone.trim())) {
      setError('Completa tu nombre y teléfono para continuar.');
      return;
    }
    if (!email.trim() || !email.trim().includes('@')) {
      setError('Escribe un correo electrónico válido.');
      return;
    }
    if (!password.trim()) {
      setError('Escribe tu contraseña para continuar.');
      return;
    }
    if (isSignup && phone.replace(/\D/g, '').length < 10) {
      setError('Escribe un teléfono con al menos 10 dígitos.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setError('');
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
      let resolvedRole: AccountRole = apiRole === 'cuidador' || apiRole === 'caregiver' ? 'caregiver' : 'family';

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
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo completar la solicitud.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityLabel="Volver" onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>{'<'}</Text>
      </Pressable>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>Q</Text></View>
      <Text style={styles.brand}>Qualify</Text>
      <Text style={styles.title}>{isSignup ? 'Crea tu cuenta' : 'Qué gusto verte'}</Text>
      <Text style={styles.subtitle}>
        {isSignup
          ? role === 'caregiver'
            ? 'Completa tus datos básicos y después armaremos tu perfil profesional en 3 pasos.'
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
          <Input label="Nombre completo" value={name} onChangeText={setName} placeholder="Tu nombre" />
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="nombre@correo.com"
          />
          <Input
            keyboardType="phone-pad"
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            placeholder="10 dígitos"
          />
        </>
      )}
      {!isSignup && (
        <Input
          autoCapitalize="none"
          keyboardType="email-address"
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          placeholder="nombre@correo.com"
        />
      )}
      <Input
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
        secureTextEntry
      />

            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable disabled={loading} onPress={submit} style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>
            {isSignup && role === 'caregiver' ? 'Continuar con mi perfil' : isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
          </Text>
        )}
      </Pressable>
      <View style={styles.switchLine}>
        <Text style={styles.switchText}>{isSignup ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}</Text>
        <Pressable onPress={() => onChangeMode(isSignup ? 'login' : 'signup')}>
          <Text style={styles.switchLink}>{isSignup ? ' Inicia sesión' : ' Regístrate'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
};

function Input({ label, ...inputProps }: InputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={inputProps.autoCapitalize}
        keyboardType={inputProps.keyboardType}
        onChangeText={inputProps.onChangeText}
        placeholder={inputProps.placeholder}
        placeholderTextColor="#95A5A8"
        secureTextEntry={inputProps.secureTextEntry}
        style={styles.input}
        value={inputProps.value}
      />
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
  screen: { backgroundColor: colors.canvas, flexGrow: 1, justifyContent: 'center', paddingHorizontal: 25, paddingVertical: 70 },
  back: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, height: 40, justifyContent: 'center', left: 20, position: 'absolute', top: 35, width: 40 },
  backText: { color: colors.ink, fontSize: 31, lineHeight: 34, marginTop: -4 },
  brandMark: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.teal, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  brandMarkText: { color: colors.white, fontSize: 24, fontWeight: '800' },
  brand: { color: colors.tealDark, fontSize: 18, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', marginTop: 34, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 27, marginTop: 8, textAlign: 'center' },
  roleRow: { flexDirection: 'row', marginBottom: 18 },
  roleOption: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 13, borderWidth: 1, flex: 1, marginRight: 8, minHeight: 105, paddingHorizontal: 8, paddingVertical: 11 },
  activeRoleOption: { backgroundColor: colors.tealPale, borderColor: colors.tealDark },
  roleIcon: { color: colors.muted, fontSize: 20 },
  activeRoleIcon: { color: colors.tealDark },
  roleLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 4 },
  roleDescription: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4, textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 13, height: 49, paddingHorizontal: 14 },
  error: { color: '#C74C45', fontSize: 12, marginBottom: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 14, marginTop: 8, paddingVertical: 15 },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  disclaimer: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 14, textAlign: 'center' },
  switchLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText: { color: colors.muted, fontSize: 12 },
  switchLink: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
});
