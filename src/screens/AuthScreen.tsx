import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const isSignup = mode === 'signup';

  const submit = () => {
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
    onComplete({
      name: isSignup ? name.trim() : email.trim().split('@')[0],
      email: email.trim(),
      phone: phone.trim(),
      role: isSignup ? role : 'family',
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityLabel="Volver" onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹</Text>
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
              icon="♡"
              label="Familia"
              onPress={() => setRole('family')}
            />
            <RoleOption
              active={role === 'caregiver'}
              description="Quiero ofrecer mis servicios"
              icon="✦"
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
      <Pressable onPress={submit} style={styles.primaryButton}>
        <Text style={styles.primaryText}>
          {isSignup && role === 'caregiver' ? 'Continuar con mi perfil' : isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
        </Text>
      </Pressable>
      <Text style={styles.disclaimer}>
        Prototipo sin conexión: tus datos no se envían ni se guardan.
      </Text>
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
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  disclaimer: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 14, textAlign: 'center' },
  switchLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText: { color: colors.muted, fontSize: 12 },
  switchLink: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
});
