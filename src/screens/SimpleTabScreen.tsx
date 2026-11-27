import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, type ScrollViewInstance, StyleSheet } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../components/LocalizedText';
import { CalendarDays, ChevronRight, LogOut, Settings2, Trash2, UsersRound } from 'lucide-react-native';
import { deleteServicio, deleteUsuario, getAbuelos, getServicios } from '../api/auth';
import { CaregiverCard } from '../components/CaregiverCard';
import { ClientProfileSection } from '../components/ClientProfileSection';
import { ConsultasChat } from '../components/ConsultasChat';
import { EditableProfileAvatar } from '../components/EditableProfileAvatar';
import { ProfileScreen } from './ProfileScreen';
import { useAppSettings } from '../context/AppSettingsContext';
import { showLocalizedAlert } from '../utils/localizedAlert';
import { FamilyTabKey, TabKey } from '../components/BottomTabBar';
import { profilePalette, secondaryColors as colors , createThemedStyles} from '../theme';
import { CareRecipient, Caregiver, Coordinates, Servicio, UserAccount } from '../types';
import { getCurrentCoordinates } from '../utils/currentServiceLocation';
import { mapServicio, matchesServicioFilter, matchesServicioSearch, servicioFilters, ServicioFilter } from '../utils/servicio';
import { filterNearbyCaregivers } from '../utils/nearbyCaregivers';
import { loadVisibleCaregivers } from '../utils/visibleCaregivers';
import type { NearbyCaregiver } from '../utils/nearbyCaregivers';

type Props = {
  tab: FamilyTabKey;
  signedInUser: UserAccount | null;
  onSelectTab: (tab: TabKey) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onSignOut: () => void;
  onUpdateUser: Dispatch<SetStateAction<UserAccount | null>>;
  onSaveCareRecipient: (recipient: CareRecipient) => void | Promise<void>;
  onDeleteCareRecipient: (recipientId: string) => void | Promise<void>;
  onSelectCaregiver: (caregiver: Caregiver) => void;
  onEditServicio: (servicio: Servicio) => void;
  servicioRefreshKey?: number;
  activeConsultaId?: number | null;
  onActiveConsultaChange?: (id: number | null) => void;
};

const copy: Record<FamilyTabKey, { title: string; subtitle: string; empty: string }> = {
  care: {
    title: 'Mis cuidados',
    subtitle: 'Aquí encontrarás tus solicitudes y servicios.',
    empty: 'Aún no tienes cuidados programados.',
  },
  messages: {
    title: 'Chats',
    subtitle: 'Conversa con cuidadores y coordina cada detalle.',
    empty: 'Tus conversaciones aparecerán aquí.',
  },
  account: {
    title: 'Mi cuenta',
    subtitle: 'Administra tu perfil y cuida de quienes más quieres.',
    empty: '',
  },
};

export function SimpleTabScreen({
  tab,
  signedInUser,
  onSelectTab,
  onOpenAuth,
  onSignOut,
  onUpdateUser,
  onSaveCareRecipient,
  onDeleteCareRecipient,
  onSelectCaregiver,
  onEditServicio,
  servicioRefreshKey,
  activeConsultaId,
  onActiveConsultaChange,
}: Props) {
  const { language } = useAppSettings();
  const content = copy[tab];
  const token = signedInUser?.token;
  const [reference, setReference] = useState<Coordinates | null>(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [nearbyCaregivers, setNearbyCaregivers] = useState<NearbyCaregiver[]>([]);
  const [nearbyError, setNearbyError] = useState('');
  const [familyServicios, setFamilyServicios] = useState<Servicio[]>([]);
  const [familyServiciosLoading, setFamilyServiciosLoading] = useState(false);
  const [servicioFilter, setServicioFilter] = useState<ServicioFilter>('todos');
  const [servicioSearch, setServicioSearch] = useState('');
  const [profileSettingsVisible, setProfileSettingsVisible] = useState(false);
  const profileScrollRef = useRef<ScrollViewInstance | null>(null);
  const familyProfileOffset = useRef(0);
  const familyRecipientsOffset = useRef(0);

  useEffect(() => {
    if (tab !== 'care') return;
    let active = true;
    const locate = async () => {
      try {
        const coordinates = await getCurrentCoordinates();
        if (active) setReference(coordinates);
      } catch {
        if (active) setReference(null);
      } finally {
        if (active) setLocationChecked(true);
      }
    };
    void locate();
    return () => { active = false; };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'care' || !token || !locationChecked) return;
    let active = true;
    const loadCaregivers = async () => {
      try {
        const data = await loadVisibleCaregivers(token);
        if (!active) return;
        setNearbyCaregivers(filterNearbyCaregivers(data, reference));
        setNearbyError('');
      } catch (e) {
        if (active) {
          setNearbyCaregivers([]);
          setNearbyError(e instanceof Error ? e.message : 'No se pudieron cargar cuidadores.');
        }
      }
    };
    void loadCaregivers();
    const interval = setInterval(() => { void loadCaregivers(); }, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [tab, token, reference, locationChecked]);

  useEffect(() => {
    if (tab !== 'care' || !token) return;
    let active = true;
    const loadServicios = async () => {
      setFamilyServiciosLoading(true);
      try {
        const [servicios, abuelos] = await Promise.all([getServicios(token), getAbuelos(token)]);
        if (!active) return;
        const patientIds = new Set(abuelos.map((item) => Number(item.id)).filter((id) => Number.isFinite(id)));
        setFamilyServicios(
          servicios
            .map(mapServicio)
            .filter((item) => patientIds.has(item.abuelo_id))
            .sort((a, b) => String(b.creado_en ?? '').localeCompare(String(a.creado_en ?? ''))),
        );
      } catch {
        if (active) setFamilyServicios([]);
      } finally {
        if (active) setFamilyServiciosLoading(false);
      }
    };
    void loadServicios();
    const interval = setInterval(() => { void loadServicios(); }, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [tab, token, servicioRefreshKey]);

  const shownServicios = familyServicios
    .filter((item) => matchesServicioFilter(item, servicioFilter))
    .filter((item) => matchesServicioSearch(item, servicioSearch));

  const removeServicioRequest = async (id: number) => {
    if (!token) return;
    try {
      await deleteServicio(id, token);
      setFamilyServicios((current) => current.filter((item) => item.id !== id));
    } catch (e) {
      showLocalizedAlert(language, 'No se pudo eliminar', e instanceof Error ? e.message : 'Intenta de nuevo.');
    }
  };

  const shownCaregivers = token ? nearbyCaregivers : [];
  const careRecipients = signedInUser?.careRecipients ?? [];
  const recipientNames = careRecipients.slice(0, 2).map((recipient) => recipient.name).filter(Boolean);
  const recipientSummary = recipientNames.length
    ? `${recipientNames.join(' & ')}${careRecipients.length > 2 ? ` +${careRecipients.length - 2}` : ''}`
    : 'Agrega personas mayores';

  const openFamilyRecipients = () => {
    profileScrollRef.current?.scrollTo({
      y: familyProfileOffset.current + familyRecipientsOffset.current,
      animated: true,
    });
  };

  const confirmSignOut = () => {
    showLocalizedAlert(language, 'Cerrar sesión', '¿Quieres cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: onSignOut },
    ]);
  };

  const deleteAccount = async () => {
    if (!signedInUser) return;
    if (!signedInUser.id) { onSignOut(); return; }
    try {
      await deleteUsuario(signedInUser.id, signedInUser.token);
      onSignOut();
    } catch (e) {
      showLocalizedAlert(language, 'No se pudo eliminar la cuenta', e instanceof Error ? e.message : 'Intenta de nuevo.');
    }
  };

  if (tab === 'messages') {
    return (
      <ConsultasChat
        token={token}
        currentUserId={signedInUser?.id}
        viewerRole={signedInUser?.role ?? 'family'}
        activeConsultaId={activeConsultaId}
        onActiveConsultaChange={onActiveConsultaChange}
        onExplore={() => onSelectTab('explore')}
      />
    );
  }

  if (tab === 'account' && signedInUser?.role === 'family') {
    return (
      <ProfileScreen
        embedded
        onClose={() => onSelectTab('explore')}
        onProfilePhotoChange={(uri) => onUpdateUser((current) =>
          current && current.email === signedInUser.email ? { ...current, profilePhotoUri: uri } : current)}
        onOpenAppointments={() => onSelectTab('care')}
        onOpenDependents={openFamilyRecipients}
        onOpenLocations={openFamilyRecipients}
        onOpenTab={onSelectTab}
        onSignOut={onSignOut}
        onDeleteAccount={deleteAccount}
        dependentsContent={
          <ClientProfileSection
            profiles={signedInUser.careRecipients ?? []}
            familiarId={signedInUser.id}
            token={signedInUser.token}
            onDelete={onDeleteCareRecipient}
            onSave={onSaveCareRecipient}
          />
        }
        user={signedInUser}
        visible
      />
    );
  }

  return (
    <ScrollView
      ref={profileScrollRef}
      contentContainerStyle={tab === 'account' ? styles.profileScreen : styles.screen}
      style={styles.screenScroll}
    >
      {tab === 'account' ? (
        <View style={styles.profileHeader}>
          <Text style={styles.profileTitle}>Perfil</Text>
          <Text style={styles.profileSubtitle}>{content.subtitle}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </>
      )}

      {tab === 'account' ? (
        signedInUser ? (
          signedInUser.role === 'family' ? (
            <View
              onLayout={(event) => { familyProfileOffset.current = event.nativeEvent.layout.y; }}
              style={styles.familyProfile}
            >
              <FamilyProfileHero
                user={signedInUser}
                recipientCount={signedInUser.careRecipients?.length ?? 0}
                onPhotoChange={(uri) => onUpdateUser((current) =>
                  current && current.email === signedInUser.email ? { ...current, profilePhotoUri: uri } : current)}
              />
              <Pressable
                accessibilityLabel={`Administrar personas mayores: ${recipientSummary}`}
                accessibilityRole="button"
                onPress={openFamilyRecipients}
                style={styles.familyRecipientsShortcut}
              >
                <View style={styles.recipientAvatarStack}>
                  {(careRecipients.length ? careRecipients.slice(0, 2) : [null]).map((recipient, index) => (
                    <View key={recipient?.id ?? 'recipient-empty'} style={[styles.recipientAvatar, index > 0 && styles.recipientAvatarOverlap]}>
                      <Text style={styles.recipientAvatarText}>{recipient?.name?.trim().charAt(0).toUpperCase() || '+'}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.familyRecipientsCopy}>
                  <Text style={styles.familyRecipientsLabel}>Mis Personas Mayores</Text>
                  <Text numberOfLines={1} style={styles.familyRecipientsSummary}>{recipientSummary}</Text>
                </View>
                <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
              </Pressable>
              <View
                onLayout={(event) => { familyRecipientsOffset.current = event.nativeEvent.layout.y; }}
                style={styles.familyRecipients}
              >
                <ClientProfileSection
                  profiles={signedInUser.careRecipients ?? []}
                  familiarId={signedInUser.id}
                  token={signedInUser.token}
                  onDelete={onDeleteCareRecipient}
                  onSave={onSaveCareRecipient}
                />
              </View>
              <Text style={styles.profileGroupTitle}>Preferencias</Text>
              <View style={styles.familyActions}>
                <Pressable accessibilityRole="button" onPress={() => onSelectTab('care')} style={[styles.familyAction, styles.familyActionLast]}>
                  <View style={styles.familyActionLeading}>
                    <CalendarDays color={profilePalette.primary} size={18} strokeWidth={1.8} />
                    <Text style={styles.familyActionText}>Mis solicitudes y servicios</Text>
                  </View>
                  <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
                </Pressable>
              </View>
              <Text style={styles.profileGroupTitle}>Configuración</Text>
              <View style={styles.familyActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setProfileSettingsVisible(true)}
                  style={[styles.familyAction, styles.familyActionLast]}
                >
                  <View style={styles.familyActionLeading}>
                    <Settings2 color={profilePalette.primary} size={18} strokeWidth={1.8} />
                    <Text style={styles.familyActionText}>Preferencias y seguridad</Text>
                  </View>
                  <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
                </Pressable>
              </View>
              <Text style={styles.profileGroupTitle}>Cuenta</Text>
              <View style={styles.familyActions}>
                <Pressable accessibilityRole="button" onPress={() => void deleteAccount()} style={styles.familyAction}>
                  <View style={styles.familyActionLeading}>
                    <Trash2 color={profilePalette.primary} size={18} strokeWidth={1.8} />
                    <Text style={styles.familyActionDanger}>Eliminar cuenta</Text>
                  </View>
                  <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={confirmSignOut} style={[styles.familyAction, styles.familyActionLast, styles.familySignOut]}>
                  <View style={styles.familyActionLeading}>
                    <LogOut color={profilePalette.primary} size={18} strokeWidth={1.8} />
                    <Text style={styles.familyActionText}>Cerrar sesión</Text>
                  </View>
                  <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.accountCard}>
              <View style={styles.profileHero}>
                <EditableProfileAvatar
                  uri={signedInUser.profilePhotoUri}
                  name={signedInUser.name}
                  size={64}
                  onChange={(uri) => onUpdateUser((current) =>
                    current && current.email === signedInUser.email ? { ...current, profilePhotoUri: uri } : current)}
                />
                <View style={styles.profileIdentity}>
                  <Text style={styles.profileEyebrow}>PERFIL</Text>
                  <Text style={styles.welcome}>{signedInUser.name}</Text>
                  <Text style={styles.accountContact}>{signedInUser.email}</Text>
                  {!!signedInUser.phone && <Text style={styles.accountContact}>{signedInUser.phone}</Text>}
                </View>
              </View>
              {signedInUser.caregiverProfile ? (
              <>
                <Text style={styles.profileCardText}>
                  {signedInUser.caregiverProfile.professionalTitle} · {signedInUser.caregiverProfile.yearsExperience} años de experiencia
                </Text>
                <Text style={styles.profileDetails}>
                  ${signedInUser.caregiverProfile.hourlyRate} MXN/h · {signedInUser.caregiverProfile.availability.days.join(', ')}
                </Text>
              </>
              ) : (
                <Text style={styles.profileCardText}>Tu sesión es solo de demostración y no está conectada a un servicio.</Text>
              )}
              <Pressable onPress={() => void deleteAccount()} style={styles.outlineButton}>
                <Text style={styles.outlineText}>Eliminar cuenta</Text>
              </Pressable>
              <Pressable onPress={confirmSignOut} style={styles.outlineButton}>
                <Text style={styles.outlineText}>Cerrar sesión</Text>
              </Pressable>
            </View>
          )
        ) : (
          <View style={styles.accountCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>U</Text></View>
            <Text style={styles.welcome}>Cuidado con confianza</Text>
            <Text style={styles.profileCardText}>Inicia sesión o crea una cuenta para organizar el cuidado de tu familia.</Text>
            <Pressable onPress={() => onOpenAuth('login')} style={styles.profilePrimaryButton}>
              <Text style={styles.profilePrimaryText}>Iniciar sesión</Text>
            </Pressable>
            <Pressable onPress={() => onOpenAuth('signup')} style={styles.outlineButton}>
              <Text style={styles.outlineText}>Crear cuenta</Text>
            </Pressable>
          </View>
        )
        ) : tab === 'care' && familyServicios.length > 0 ? null : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{tab === 'care' ? '▣' : '○'}</Text>
          <Text style={styles.emptyTitle}>{content.empty}</Text>
          <Text style={styles.cardText}>
            {tab === 'care'
              ? 'Cuando solicites un servicio, podrás consultar aquí los detalles.'
              : 'Cuando contactes a un cuidador, la conversación estará aquí.'}
          </Text>
          <Pressable onPress={() => onSelectTab('explore')} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Explorar cuidadores</Text>
          </Pressable>
        </View>
      )}

      {tab === 'care' && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionTitle}>Mis solicitudes</Text>
          <TextInput
            onChangeText={setServicioSearch}
            placeholder="Buscar por paciente, cuidador, nota o ID"
            placeholderTextColor={colors.line}
            style={styles.serviceSearch}
            value={servicioSearch}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.serviceFilters}>
            {servicioFilters.map((filter) => (
              <Pressable
                key={filter.key}
                onPress={() => setServicioFilter(filter.key)}
                style={[styles.serviceFilterChip, servicioFilter === filter.key && styles.serviceFilterChipActive]}
              >
                <Text style={[styles.serviceFilterText, servicioFilter === filter.key && styles.serviceFilterTextActive]}>{filter.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {familyServiciosLoading && <ActivityIndicator color={colors.tealDark} style={{ marginBottom: 10 }} />}
          {!familyServiciosLoading && familyServicios.length === 0 && (
            <Text style={styles.suggestionInfo}>Todavía no has solicitado servicios.</Text>
          )}
          {!familyServiciosLoading && familyServicios.length > 0 && shownServicios.length === 0 && (
            <Text style={styles.suggestionInfo}>No hay servicios con ese filtro o búsqueda.</Text>
          )}
          {shownServicios.map((servicio) => (
            <View key={servicio.id} style={styles.serviceCard}>
              <View style={styles.serviceTopLine}>
                <Text style={styles.serviceTitle}>{servicio.abuelo_nombre ?? `Paciente ${servicio.abuelo_id}`}</Text>
                <Text style={styles.serviceStatus}>{servicio.estado}</Text>
              </View>
              <Text style={styles.serviceInfo}>Cuidador: {servicio.cuidador_nombre ?? `#${servicio.cuidador_id}`}</Text>
              <Text style={styles.serviceInfo}>{servicio.inicio} → {servicio.fin}</Text>
              <Text style={styles.serviceNote}>{servicio.nota || 'Sin nota'}</Text>
              <Text style={styles.serviceMeta}>
                ${servicio.total} · Pago: {servicio.estado_pago} · Familiar: {servicio.aceptado_por_familiar ? 'aceptó' : 'pendiente'} · Cuidador: {servicio.aceptado_por_cuidador ? 'aceptó' : 'pendiente'}
              </Text>
              <View style={styles.serviceActions}>
                <Pressable onPress={() => onEditServicio(servicio)} style={styles.serviceAction}><Text style={styles.serviceActionText}>Editar</Text></Pressable>
                <Pressable onPress={() => void removeServicioRequest(servicio.id)} style={[styles.serviceAction, styles.serviceActionDanger]}><Text style={styles.serviceActionDangerText}>Eliminar</Text></Pressable>
              </View>
            </View>
          ))}
          <Text style={[styles.suggestionTitle, { marginTop: 14 }]}>Cuidadores cerca de ti</Text>
          <Text style={styles.suggestionInfo}>
            {reference
              ? 'Ordenados por distancia desde tu ubicación'
              : 'Ubicación desactivada · se muestran todos'}
          </Text>
          {!token && <Text style={styles.suggestionInfo}>Inicia sesión para ver cuidadores disponibles.</Text>}
          {!!nearbyError && <Text style={styles.suggestionError}>{nearbyError}</Text>}
          {shownCaregivers.map((caregiver) => (
            <CaregiverCard
              key={caregiver.id}
              caregiver={caregiver}
              compact
              onPress={() => onSelectCaregiver(caregiver)}
            />
          ))}
          {locationChecked && !!token && !nearbyError && shownCaregivers.length === 0 && (
            <Text style={styles.suggestionInfo}>
              {reference
                  ? 'No hay cuidadores activos. Deben tener el switch de disponible encendido y ubicación reciente.'
                  : 'No hay cuidadores activos en el mapa. Activa la ubicación para ordenar por cercanía.'}
            </Text>
          )}
        </View>
      )}
      {tab === 'account' && signedInUser && (
        <ProfileScreen
          onClose={() => {
            setProfileSettingsVisible(false);
            if (signedInUser.role === 'family') onSelectTab('explore');
          }}
          onProfilePhotoChange={(uri) => onUpdateUser((current) =>
            current && current.email === signedInUser.email ? { ...current, profilePhotoUri: uri } : current)}
          onOpenAppointments={() => onSelectTab('care')}
          onOpenDependents={openFamilyRecipients}
          onOpenLocations={openFamilyRecipients}
          onOpenTab={onSelectTab}
          onSignOut={onSignOut}
          onDeleteAccount={deleteAccount}
          dependentsContent={signedInUser.role === 'family' ? (
            <ClientProfileSection
              profiles={signedInUser.careRecipients ?? []}
              familiarId={signedInUser.id}
              token={signedInUser.token}
              onDelete={onDeleteCareRecipient}
              onSave={onSaveCareRecipient}
            />
          ) : undefined}
          user={signedInUser}
          visible={signedInUser.role === 'family' ? tab === 'account' : profileSettingsVisible}
        />
      )}
    </ScrollView>
  );
}

function FamilyProfileHero({
  user,
  recipientCount,
  onPhotoChange,
}: {
  user: UserAccount;
  recipientCount: number;
  onPhotoChange: (uri: string) => void;
}) {
  return (
    <View style={styles.familyHero}>
      <View style={styles.familyUserCard}>
        <EditableProfileAvatar
          uri={user.profilePhotoUri}
          name={user.name}
          size={72}
          onChange={onPhotoChange}
        />
        <View style={styles.familyIdentity}>
          <View style={styles.familyRoleLine}>
            <View style={styles.familyRoleBadge}>
              <Text style={styles.familyRoleBadgeText}>Familiar</Text>
            </View>
          </View>
          <Text style={styles.familyDisplayName}>{user.name}</Text>
          <Text numberOfLines={1} style={styles.familyDisplaySubtitle}>{user.email}</Text>
          {!!user.phone && <Text style={styles.familyDisplaySubtitle}>{user.phone}</Text>}
        </View>
      </View>
      <View style={styles.familySummaryCard}>
        <Text style={styles.profileSectionTitle}>Resumen de cuenta</Text>
        <View style={styles.familyStats}>
          <FamilyStat value={String(recipientCount)} label="Personas mayores" />
          <View style={styles.familyStatDivider} />
          <FamilyStat value={user.phone ? 'Sí' : '—'} label="Teléfono" />
          <View style={styles.familyStatDivider} />
          <FamilyStat value={user.id ? 'Activa' : 'Demo'} label="Cuenta" />
        </View>
        <View style={styles.familyCareHint}>
          <UsersRound color={profilePalette.primary} size={20} strokeWidth={1.8} style={styles.familyCareHintIcon} />
          <View style={styles.familyCareHintCopy}>
            <Text style={styles.familyCareHintTitle}>Cuidado familiar</Text>
            <Text style={styles.familyCareHintText}>Administra aquí los datos de las personas que acompañas.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FamilyStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.familyStat}>
      <Text style={styles.familyStatValue}>{value}</Text>
      <Text style={styles.familyStatLabel}>{label}</Text>
    </View>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  screenScroll: { flex: 1 },
  screen: { backgroundColor: colors.canvas, flexGrow: 1, paddingHorizontal: 19, paddingTop: 30, paddingBottom: 46 },
  profileScreen: { backgroundColor: profilePalette.canvas, flexGrow: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 112 },
  profileHeader: { marginBottom: 17 },
  profileTitle: { color: profilePalette.ink, fontSize: 24, fontWeight: '800' },
  profileSubtitle: { color: profilePalette.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  familyProfile: { flex: 1 },
  familyHero: { gap: 12 },
  familyUserCard: { alignItems: 'center', backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, flexDirection: 'row', padding: 15 },
  familyIdentity: { flex: 1, marginLeft: 13, minWidth: 0 },
  familyDisplayName: { color: profilePalette.ink, fontSize: 17, fontWeight: '800' },
  familyDisplaySubtitle: { color: profilePalette.secondary, fontSize: 11, marginTop: 4 },
  familyRoleLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  familyRoleBadge: { backgroundColor: profilePalette.light, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  familyRoleBadgeText: { color: profilePalette.primary, fontSize: 10, fontWeight: '700' },
  familySummaryCard: { backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, padding: 15 },
  profileSectionTitle: { color: profilePalette.secondary, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  familyStats: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 13, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  familyStat: { alignItems: 'center', flex: 1 },
  familyStatValue: { color: profilePalette.ink, fontSize: 16, fontWeight: '800' },
  familyStatLabel: { color: profilePalette.primary, fontSize: 9, marginTop: 4, textAlign: 'center' },
  familyStatDivider: { backgroundColor: profilePalette.neutral, height: 30, width: 1 },
  familyCareHint: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 13, flexDirection: 'row', marginTop: 11, paddingHorizontal: 11, paddingVertical: 10 },
  familyCareHintIcon: { marginRight: 9 },
  familyCareHintCopy: { flex: 1 },
  familyCareHintTitle: { color: profilePalette.ink, fontSize: 11, fontWeight: '800' },
  familyCareHintText: { color: profilePalette.primary, fontSize: 10, lineHeight: 14, marginTop: 3 },
  familyRecipientsShortcut: { alignItems: 'center', backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginTop: 12, minHeight: 72, paddingHorizontal: 13, paddingVertical: 11 },
  recipientAvatarStack: { flexDirection: 'row', minWidth: 42 },
  recipientAvatar: { alignItems: 'center', backgroundColor: profilePalette.light, borderColor: profilePalette.white, borderRadius: 20, borderWidth: 2, height: 40, justifyContent: 'center', width: 40 },
  recipientAvatarOverlap: { marginLeft: -11 },
  recipientAvatarText: { color: profilePalette.primary, fontSize: 13, fontWeight: '800' },
  familyRecipientsCopy: { flex: 1, marginLeft: 10, minWidth: 0 },
  familyRecipientsLabel: { color: profilePalette.secondary, fontSize: 10, fontWeight: '600' },
  familyRecipientsSummary: { color: profilePalette.ink, fontSize: 13, fontWeight: '700', marginTop: 3 },
  familyRecipients: { alignSelf: 'stretch', marginTop: 14 },
  profileGroupTitle: { color: profilePalette.secondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 18 },
  familyActions: { backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, marginTop: 14, paddingHorizontal: 13 },
  familyAction: { alignItems: 'center', borderBottomColor: profilePalette.neutral, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 54 },
  familyActionLeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  familyActionLast: { borderBottomWidth: 0 },
  familySignOut: { backgroundColor: profilePalette.light, borderBottomWidth: 0, borderRadius: 12, marginBottom: 9, marginTop: 8, minHeight: 48, paddingHorizontal: 11 },
  familyActionText: { color: profilePalette.ink, fontSize: 13, fontWeight: '700' },
  familyActionDanger: { color: profilePalette.primary, fontSize: 13, fontWeight: '700' },
  title: { color: colors.tealDark, fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  accountCard: { alignItems: 'stretch', backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, marginTop: 3, overflow: 'hidden', padding: 16 },
  profileHero: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 14, flexDirection: 'row', padding: 14 },
  profileIdentity: { flex: 1, marginLeft: 13 },
  profileEyebrow: { color: profilePalette.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  avatar: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 31, height: 62, justifyContent: 'center', width: 62 },
  avatarText: { color: profilePalette.primary, fontSize: 27, fontWeight: '700' },
  welcome: { color: profilePalette.ink, fontSize: 18, fontWeight: '800', marginTop: 4, textAlign: 'left' },
  roleBadge: { backgroundColor: profilePalette.light, borderRadius: 12, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText: { color: profilePalette.primary, fontSize: 10, fontWeight: '700' },
  accountContact: { color: profilePalette.secondary, fontSize: 10, marginTop: 4, textAlign: 'left' },
  profileCardText: { color: profilePalette.secondary, fontSize: 11, lineHeight: 17, marginTop: 10, textAlign: 'left' },
  cardText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  profileDetails: { color: profilePalette.primary, fontSize: 11, fontWeight: '700', marginTop: 8 },
  profilePrimaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: profilePalette.primary, borderRadius: 12, marginTop: 17, paddingVertical: 13 },
  profilePrimaryText: { color: profilePalette.white, fontSize: 12, fontWeight: '800' },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.teal, borderRadius: 13, marginTop: 18, paddingVertical: 13 },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  outlineButton: { alignItems: 'center', alignSelf: 'stretch', borderColor: profilePalette.neutral, borderRadius: 12, borderWidth: 1, marginTop: 10, paddingVertical: 12 },
  outlineText: { color: profilePalette.primary, fontSize: 12, fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, marginTop: 25, padding: 22 },
  emptyIcon: { color: colors.teal, fontSize: 31 },
  emptyTitle: { color: colors.tealDark, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  suggestions: { marginTop: 23 },
  suggestionTitle: { color: colors.tealDark, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  serviceSearch: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 11, marginBottom: 9, paddingHorizontal: 11, paddingVertical: 9 },
  serviceFilters: { flexGrow: 0, marginBottom: 10 },
  serviceFilterChip: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginRight: 7, paddingHorizontal: 11, paddingVertical: 7 },
  serviceFilterChipActive: { backgroundColor: colors.teal, borderColor: colors.tealDark },
  serviceFilterText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  serviceFilterTextActive: { color: colors.white },
  serviceCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, marginBottom: 9, padding: 14 },
  serviceTopLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  serviceTitle: { color: colors.tealDark, flex: 1, fontSize: 12, fontWeight: '800' },
  serviceStatus: { backgroundColor: colors.highlightSoft, borderRadius: 9, color: colors.ink, fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  serviceInfo: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  serviceNote: { color: colors.ink, fontSize: 10, lineHeight: 14, marginTop: 7 },
  serviceMeta: { color: colors.tealDark, fontSize: 9, lineHeight: 13, marginTop: 7 },
  serviceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  serviceAction: { backgroundColor: colors.tealPale, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  serviceActionText: { color: colors.tealDark, fontSize: 9, fontWeight: '800' },
  serviceActionDanger: { backgroundColor: colors.tealPale },
  serviceActionDangerText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  suggestionInfo: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  suggestionError: { color: colors.accent, fontSize: 11, lineHeight: 16, marginBottom: 10 },
}));
