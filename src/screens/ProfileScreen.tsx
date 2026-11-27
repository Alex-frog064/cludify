import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  View,
 StyleSheet} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  ChevronRight,
  Globe,
  HelpCircle,
  Info,
  LogOut,
  MapPin,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserRoundPlus,
  UserRound,
} from 'lucide-react-native';
import { updateUsuario } from '../api/auth';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { EditableProfileAvatar } from '../components/EditableProfileAvatar';
import { LocalizedText as Text, LocalizedTextInput } from '../components/LocalizedText';
import { useAppSettings, type AppLanguage } from '../context/AppSettingsContext';
import { translateText } from '../i18n';
import { colors, createThemedStyles } from '../theme';
import type { TabKey } from '../components/BottomTabBar';
import type { UserAccount } from '../types';

type SettingsPage = 'profile' | 'dependents' | 'security' | 'notifications' | 'language' | 'locations' | 'appointments' | 'about' | 'help';
type ProfileConfirmation = 'signOut' | 'deleteAccount' | null;

type Props = {
  visible: boolean;
  user: UserAccount;
  onClose: () => void;
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<void> | void;
  onOpenTab: (tab: TabKey) => void;
  onEditProfile?: () => void;
  onProfilePhotoChange?: (uri: string) => void;
  onOpenDependents?: () => void;
  dependentsContent?: ReactNode;
  onOpenLocations?: () => void;
  onOpenAppointments?: () => void;
  embedded?: boolean;
};

const languageNames: Record<AppLanguage, string> = { es: 'Español', en: 'English' };

export function ProfileScreen({
  visible,
  user,
  onClose,
  onSignOut,
  onDeleteAccount,
  onOpenTab,
  onEditProfile,
  onProfilePhotoChange,
  onOpenDependents,
  dependentsContent,
  onOpenLocations,
  onOpenAppointments,
  embedded = false,
}: Props) {
  const { themeMode, language, notifications, updateSettings, persistenceError } = useAppSettings();
  const [page, setPage] = useState<SettingsPage | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<ProfileConfirmation>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const recipients = useMemo(() => user.careRecipients ?? [], [user.careRecipients]);
  const recipientNames = recipients.slice(0, 2).map((recipient) => recipient.name).filter(Boolean);
  const recipientSummary = recipientNames.length
    ? `${recipientNames.join(' & ')}${recipients.length > 2 ? ` +${recipients.length - 2}` : ''}`
    : '';
  const roleLabel = user.role === 'caregiver' ? 'Cuidador' : 'Familiar';
  const AppearanceIcon = themeMode === 'dark' ? Sun : Moon;

  const closeSettings = () => {
    setPage(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    onClose();
  };

  const closeAnd = (callback?: () => void) => {
    closeSettings();
    callback?.();
  };

  const openTab = (tab: TabKey, callback?: () => void) => {
    closeSettings();
    if (callback) callback();
    else onOpenTab(tab);
  };

  const savePassword = async () => {
    setPasswordError('');
    if (!user.id) {
      setPasswordError('No se encontró el identificador de tu cuenta.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    setPasswordSaving(true);
    try {
      await updateUsuario(user.id, { password: newPassword }, user.token);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(
        translateText('Contraseña actualizada', language),
        translateText('Tu contraseña se guardó correctamente.', language),
      );
      setPage(null);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const confirmSignOut = () => setConfirmation('signOut');
  const confirmDeleteAccount = () => setConfirmation('deleteAccount');

  const confirmAccountAction = async () => {
    if (confirmation === 'signOut') {
      setConfirmation(null);
      onSignOut();
      return;
    }
    if (confirmation !== 'deleteAccount' || !onDeleteAccount) return;

    setDeletingAccount(true);
    try {
      await onDeleteAccount();
      setConfirmation(null);
    } catch (error) {
      Alert.alert(
        translateText('No se pudo eliminar la cuenta', language),
        error instanceof Error ? error.message : translateText('Intenta de nuevo.', language),
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const updatePreference = async (patch: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(patch);
    } catch (error) {
      Alert.alert(
        translateText('No se pudo guardar', language),
        error instanceof Error ? error.message : translateText('Intenta de nuevo.', language),
      );
    }
  };

  const renderMain = () => (
    <>
      <View style={styles.userCard}>
        {onProfilePhotoChange ? (
          <EditableProfileAvatar
            name={user.name}
            onChange={onProfilePhotoChange}
            size={62}
            uri={user.profilePhotoUri}
          />
        ) : user.profilePhotoUri ? (
          <Image
            accessibilityLabel={translateText('Foto de perfil', language)}
            resizeMode="cover"
            source={{ uri: user.profilePhotoUri }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{user.name.trim().charAt(0).toUpperCase() || 'U'}</Text>
          </View>
        )}
        <View style={styles.userCopy}>
          <Text numberOfLines={2} style={styles.userName}>{user.name}</Text>
          <Text numberOfLines={1} style={styles.userEmail}>{user.email}</Text>
          {!!user.phone && <Text numberOfLines={1} style={styles.userEmail}>{user.phone}</Text>}
          <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleLabel}</Text></View>
        </View>
      </View>

      {user.role === 'family' && (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={!dependentsContent && !onOpenDependents}
            onPress={() => (dependentsContent ? setPage('dependents') : closeAnd(onOpenDependents))}
            style={({ pressed }) => [styles.dependentsCard, pressed && styles.pressed]}
          >
            <View style={styles.dependentAvatars}>
              {(recipients.length ? recipients.slice(0, 2) : [null]).map((recipient, index) => (
                <View
                  key={recipient?.id ?? 'recipient-placeholder'}
                  style={[styles.dependentAvatar, index > 0 && styles.dependentAvatarOverlap]}
                >
                  <Text style={styles.dependentAvatarText}>{recipient?.name?.trim().charAt(0).toUpperCase() || '+'}</Text>
                </View>
              ))}
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Mis Personas Mayores</Text>
              <Text numberOfLines={1} style={styles.rowSubtitle}>
                {recipientSummary || 'Agrega personas mayores'}
              </Text>
            </View>
            <ChevronRight color={colors.line} size={20} strokeWidth={1.8} />
          </Pressable>
          {!!dependentsContent && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPage('dependents')}
              style={({ pressed }) => [styles.addDependentButton, pressed && styles.pressed]}
            >
              <UserRoundPlus color={colors.white} size={17} strokeWidth={2} />
              <Text style={styles.addDependentText}>Agregar persona mayor</Text>
            </Pressable>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>Cuenta</Text>
      <View style={styles.groupCard}>
        {onEditProfile && (
          <SettingsRow
            icon={<UserRound color={colors.ink} size={19} strokeWidth={1.8} />}
            title="Editar perfil"
            onPress={() => (onEditProfile ? closeAnd(onEditProfile) : setPage('profile'))}
          />
        )}
        <SettingsRow
          icon={<ShieldCheck color={colors.ink} size={19} strokeWidth={1.8} />}
          title="Seguridad y privacidad"
          onPress={() => setPage('security')}
          last
        />
      </View>

      <Text style={styles.sectionTitle}>Configuración</Text>
      <View style={styles.groupCard}>
        <View style={styles.switchRow}>
          <View style={styles.leadingIcon}><AppearanceIcon color={colors.ink} size={19} strokeWidth={1.8} /></View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Apariencia</Text>
            <Text style={styles.rowSubtitle}>{themeMode === 'dark' ? 'Modo oscuro' : 'Modo claro'}</Text>
          </View>
          <Switch
            accessibilityLabel={translateText('Modo oscuro', language)}
            accessibilityRole="switch"
            accessibilityState={{ checked: themeMode === 'dark' }}
            onValueChange={(enabled) => void updatePreference({ themeMode: enabled ? 'dark' : 'light' })}
            trackColor={{ false: colors.line, true: colors.teal }}
            thumbColor={colors.white}
            value={themeMode === 'dark'}
          />
        </View>
        <SettingsRow
          icon={<Bell color={colors.ink} size={19} strokeWidth={1.8} />}
          title="Notificaciones"
          subtitle="Preferencias locales"
          onPress={() => setPage('notifications')}
        />
        <SettingsRow
          icon={<Globe color={colors.ink} size={19} strokeWidth={1.8} />}
          title="Idioma"
          subtitle={languageNames[language]}
          onPress={() => setPage('language')}
          last
        />
      </View>

      <Text style={styles.sectionTitle}>Preferencias</Text>
      <View style={styles.groupCard}>
        <SettingsRow
          icon={<MapPin color={colors.ink} size={19} strokeWidth={1.8} />}
          title="Direcciones y ubicaciones"
          onPress={() => setPage('locations')}
        />
        <SettingsRow
          icon={<CalendarDays color={colors.ink} size={19} strokeWidth={1.8} />}
          title="Mis citas y horarios"
          onPress={() => setPage('appointments')}
        />
        <SettingsRow
          icon={<Info color={colors.ink} size={19} strokeWidth={1.8} />}
          title="Sobre nosotros"
          onPress={() => setPage('about')}
          last
        />
      </View>

      <Text style={styles.sectionTitle}>Soporte y cuenta</Text>
      <View style={styles.groupCard}>
        <SettingsRow
          icon={<HelpCircle color={colors.ink} size={19} strokeWidth={1.8} />}
          title="Centro de ayuda"
          onPress={() => setPage('help')}
        />
        {onDeleteAccount && (
          <SettingsRow
            icon={<Trash2 color={colors.teal} size={19} strokeWidth={1.8} />}
            title="Eliminar cuenta"
            onPress={confirmDeleteAccount}
          />
        )}
        <SettingsRow
          icon={<LogOut color={colors.teal} size={19} strokeWidth={1.8} />}
          title="Cerrar sesión"
          onPress={confirmSignOut}
          last
        />
      </View>
    </>
  );

  const renderPage = () => {
    if (!page) return null;

    if (page === 'profile') {
      return (
        <View style={styles.pageCard}>
          <View style={styles.editProfileHeader}>
            {onProfilePhotoChange && (
              <EditableProfileAvatar
                name={user.name}
                onChange={onProfilePhotoChange}
                size={76}
                uri={user.profilePhotoUri}
              />
            )}
            <View style={styles.editProfileIdentity}>
              <Text style={styles.panelTitle}>{user.name}</Text>
              <Text style={styles.panelDescription}>{roleLabel}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.rowSubtitle}>Correo</Text>
            <Text style={styles.rowTitle}>{user.email}</Text>
          </View>
          {!!user.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.rowSubtitle}>Teléfono</Text>
              <Text style={styles.rowTitle}>{user.phone}</Text>
            </View>
          )}
        </View>
      );
    }

    if (page === 'dependents') {
      return <View style={styles.dependentsPage}>{dependentsContent}</View>;
    }

    if (page === 'security') {
      return (
        <View style={styles.pageCard}>
          <View style={styles.panelIcon}><ShieldCheck color={colors.teal} size={22} strokeWidth={1.8} /></View>
          <Text style={styles.panelTitle}>Seguridad y privacidad</Text>
          <Text style={styles.panelDescription}>Actualiza la contraseña de tu cuenta. Usa al menos 8 caracteres.</Text>
          <LocalizedTextInput
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={setNewPassword}
            placeholder="Nueva contraseña"
            secureTextEntry
            style={styles.input}
            value={newPassword}
          />
          <LocalizedTextInput
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={setConfirmPassword}
            placeholder="Confirmar contraseña"
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
          />
          {!!passwordError && <Text accessibilityRole="alert" style={styles.errorText}>{passwordError}</Text>}
          <Pressable disabled={passwordSaving} onPress={() => void savePassword()} style={[styles.primaryButton, passwordSaving && styles.disabled]}>
            {passwordSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Guardar contraseña</Text>}
          </Pressable>
        </View>
      );
    }

    if (page === 'notifications') {
      return (
        <View style={styles.pageCard}>
          <View style={styles.panelIcon}><Bell color={colors.teal} size={22} strokeWidth={1.8} /></View>
          <Text style={styles.panelTitle}>Notificaciones</Text>
          <Text style={styles.panelDescription}>Estas preferencias se guardan en este dispositivo. La app aún no envía notificaciones push.</Text>
          <PreferenceSwitch
            label="Solicitudes y servicios"
            value={notifications.care}
            onChange={(care) => void updatePreference({ notifications: { care } })}
          />
          <PreferenceSwitch
            label="Mensajes"
            value={notifications.messages}
            onChange={(messages) => void updatePreference({ notifications: { messages } })}
          />
          <PreferenceSwitch
            label="Novedades de la cuenta"
            value={notifications.updates}
            onChange={(updates) => void updatePreference({ notifications: { updates } })}
            last
          />
        </View>
      );
    }

    if (page === 'language') {
      return (
        <View style={styles.pageCard}>
          <View style={styles.panelIcon}><Globe color={colors.teal} size={22} strokeWidth={1.8} /></View>
          <Text style={styles.panelTitle}>Idioma</Text>
          <Text style={styles.panelDescription}>El idioma seleccionado se aplica a los textos de la aplicación y se guarda en este dispositivo.</Text>
          {(['es', 'en'] as const).map((option) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: language === option }}
              key={option}
              onPress={() => void updatePreference({ language: option })}
              style={[styles.languageOption, option === 'en' && styles.languageOptionLast]}
            >
              <Text style={styles.rowTitle}>{languageNames[option]}</Text>
              <View style={[styles.radio, language === option && styles.radioSelected]}>
                {language === option && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}
        </View>
      );
    }

    if (page === 'locations') {
      return (
        <View style={styles.pageCard}>
          <View style={styles.panelIcon}><MapPin color={colors.teal} size={22} strokeWidth={1.8} /></View>
          <Text style={styles.panelTitle}>Direcciones y ubicaciones</Text>
          <Text style={styles.panelDescription}>
            {user.role === 'caregiver'
              ? user.caregiverProfile?.serviceLocation || 'Administra tu zona de servicio y ubicación desde tu perfil.'
              : 'Administra las ubicaciones de las personas mayores registradas en tu cuenta.'}
          </Text>
          <Pressable
            onPress={() => {
              if (user.role === 'family' && dependentsContent) setPage('dependents');
              else openTab(user.role === 'caregiver' ? 'profile' : 'account', onOpenLocations);
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {user.role === 'caregiver' ? 'Abrir ubicación de servicio' : 'Administrar ubicaciones'}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (page === 'appointments') {
      return (
        <View style={styles.pageCard}>
          <View style={styles.panelIcon}><CalendarDays color={colors.teal} size={22} strokeWidth={1.8} /></View>
          <Text style={styles.panelTitle}>Mis citas y horarios</Text>
          <Text style={styles.panelDescription}>
            {user.role === 'caregiver'
              ? 'Consulta tus solicitudes, servicios y horarios en el espacio de trabajo.'
              : 'Consulta las solicitudes y servicios de cuidado de tu familia.'}
          </Text>
          <Pressable
            onPress={() => openTab(user.role === 'caregiver' ? 'clients' : 'care', onOpenAppointments)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {user.role === 'caregiver' ? 'Ver solicitudes y servicios' : 'Ver mis cuidados'}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (page === 'about') {
      return (
        <View style={styles.pageCard}>
          <View style={styles.panelIcon}><Info color={colors.teal} size={22} strokeWidth={1.8} /></View>
          <Text style={styles.panelTitle}>Sobre nosotros</Text>
          <Text style={styles.panelDescription}>Cludify conecta a familias con cuidadores para organizar el cuidado de personas mayores con más confianza y claridad.</Text>
          <View style={styles.infoRow}>
            <Text style={styles.rowSubtitle}>Aplicación</Text>
            <Text style={styles.rowTitle}>Cludify</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.pageCard}>
        <View style={styles.panelIcon}><HelpCircle color={colors.teal} size={22} strokeWidth={1.8} /></View>
        <Text style={styles.panelTitle}>Centro de ayuda</Text>
        <Text style={styles.panelDescription}>Puedes revisar tus datos de perfil, verificar tu conexión y volver a intentar cualquier acción que haya fallado.</Text>
        <View style={styles.helpItem}>
          <Text style={styles.rowTitle}>¿No encuentras un servicio?</Text>
          <Text style={styles.rowSubtitle}>Revisa el estado de tu solicitud en Mis citas y horarios.</Text>
        </View>
        <View style={[styles.helpItem, styles.helpItemLast]}>
          <Text style={styles.rowTitle}>¿Necesitas cambiar tus datos?</Text>
          <Text style={styles.rowSubtitle}>Abre Editar perfil desde la pantalla de Perfil.</Text>
        </View>
      </View>
    );
  };

  const title = page ? pageTitle(page) : 'Perfil';

  const screenContent = (
    <>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={translateText(page ? 'Volver' : 'Cerrar perfil', language)}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => (page ? setPage(null) : closeSettings())}
            style={styles.backButton}
          >
            <ArrowLeft color={colors.ink} size={21} strokeWidth={1.9} />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {page ? renderPage() : renderMain()}
            {!!persistenceError && (
              <Text accessibilityRole="alert" style={styles.errorText}>{persistenceError}</Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <ConfirmationModal
          confirmLabel={confirmation === 'deleteAccount' ? 'Eliminar cuenta' : 'Cerrar sesión'}
          destructive
          loading={deletingAccount}
          message={confirmation === 'deleteAccount'
            ? '¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.'
            : '¿Quieres cerrar tu sesión?'}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => { void confirmAccountAction(); }}
          title={confirmation === 'deleteAccount' ? 'Eliminar cuenta' : 'Cerrar sesión'}
          visible={confirmation !== null}
        />
    </>
  );

  if (embedded) {
    return <View style={styles.container}>{screenContent}</View>;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => (page ? setPage(null) : closeSettings())}
      visible={visible}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        {screenContent}
      </SafeAreaView>
    </Modal>
  );
}

function pageTitle(page: SettingsPage) {
  const titles: Record<SettingsPage, string> = {
    profile: 'Editar perfil',
    dependents: 'Mis Personas Mayores',
    security: 'Seguridad y privacidad',
    notifications: 'Notificaciones',
    language: 'Idioma',
    locations: 'Direcciones y ubicaciones',
    appointments: 'Mis citas y horarios',
    about: 'Sobre nosotros',
    help: 'Centro de ayuda',
  };
  return titles[page];
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, last && styles.settingsRowLast, pressed && styles.pressed]}
    >
      <View style={styles.leadingIcon}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <ChevronRight color={colors.line} size={19} strokeWidth={1.8} />
    </Pressable>
  );
}

function PreferenceSwitch({
  label,
  value,
  onChange,
  last = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  const { language } = useAppSettings();
  return (
    <View style={[styles.preferenceRow, last && styles.preferenceRowLast]}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Switch
        accessibilityLabel={translateText(label, language)}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.teal }}
        thumbColor={colors.white}
        value={value}
      />
    </View>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  container: { backgroundColor: colors.canvas, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 54, paddingHorizontal: 18 },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  headerTitle: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '800', marginLeft: 8 },
  headerSpacer: { width: 24 },
  content: { flexGrow: 1, paddingBottom: 104, paddingHorizontal: 18, paddingTop: 10 },
  userCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: 'row', marginBottom: 15, padding: 15 },
  editProfileHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: 4 },
  editProfileIdentity: { flex: 1, marginLeft: 14 },
  dependentsPage: { flex: 1 },
  avatar: { backgroundColor: colors.tealPale, borderRadius: 31, height: 62, width: 62 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.teal, fontSize: 25, fontWeight: '800' },
  userCopy: { flex: 1, marginLeft: 13, minWidth: 0 },
  userName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  userEmail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: colors.teal, borderRadius: 12, marginTop: 7, paddingHorizontal: 9, paddingVertical: 5 },
  roleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  dependentsCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 5, minHeight: 69, paddingHorizontal: 13 },
  addDependentButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.teal, borderRadius: 12, flexDirection: 'row', gap: 8, marginBottom: 5, minHeight: 42, paddingHorizontal: 14 },
  addDependentText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  dependentAvatars: { flexDirection: 'row', minWidth: 43 },
  dependentAvatar: { alignItems: 'center', backgroundColor: colors.tealPale, borderColor: colors.surface, borderRadius: 18, borderWidth: 2, height: 36, justifyContent: 'center', width: 36 },
  dependentAvatarOverlap: { marginLeft: -11 },
  dependentAvatarText: { color: colors.teal, fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 15 },
  groupCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12 },
  settingsRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingVertical: 8 },
  settingsRowLast: { borderBottomWidth: 0 },
  switchRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', minHeight: 60 },
  leadingIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 20, height: 38, justifyContent: 'center', marginRight: 11, width: 38 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  rowSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  pressed: { opacity: 0.72 },
  pageCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 17 },
  panelIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 24, height: 48, justifyContent: 'center', marginBottom: 14, width: 48 },
  panelTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  panelDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  input: { backgroundColor: colors.canvas, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 14, marginTop: 12, minHeight: 48, paddingHorizontal: 13 },
  errorText: { color: colors.tealDark, fontSize: 11, lineHeight: 16, marginTop: 9 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 12, justifyContent: 'center', marginTop: 15, minHeight: 48, paddingHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.6 },
  preferenceRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 57 },
  preferenceRowLast: { borderBottomWidth: 0 },
  languageOption: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 55 },
  languageOptionLast: { borderBottomWidth: 0 },
  radio: { alignItems: 'center', borderColor: colors.line, borderRadius: 10, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 },
  radioSelected: { borderColor: colors.teal },
  radioDot: { backgroundColor: colors.teal, borderRadius: 5, height: 10, width: 10 },
  infoRow: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 18, paddingTop: 13 },
  helpItem: { borderBottomColor: colors.line, borderBottomWidth: 1, marginTop: 15, paddingBottom: 13 },
  helpItemLast: { borderBottomWidth: 0, paddingBottom: 0 },
}));
