import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View, type ScrollViewInstance, StyleSheet } from 'react-native';
import { LocalizedText as Text } from '../components/LocalizedText';
import { BadgeCheck, ChevronDown, ChevronRight, LogOut, MapPin, Search, Settings2, Star, Trash2, UsersRound } from 'lucide-react-native';
import { deleteUsuario } from '../api/auth';
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

type CaregiverSort = 'distance' | 'rating' | 'price';

const copy: Record<FamilyTabKey, { title: string; subtitle: string; empty: string }> = {
  care: {
    title: 'Cuidadores',
    subtitle: 'Encuentra apoyo de confianza cerca de ti.',
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
  activeConsultaId,
  onActiveConsultaChange,
}: Props) {
  const { language } = useAppSettings();
  const { width: windowWidth } = useWindowDimensions();
  const content = copy[tab];
  const token = signedInUser?.token;
  const [reference, setReference] = useState<Coordinates | null>(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [nearbyCaregivers, setNearbyCaregivers] = useState<NearbyCaregiver[]>([]);
  const [caregiversLoading, setCaregiversLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState('Todas');
  const [caregiverSort, setCaregiverSort] = useState<CaregiverSort>('rating');
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
      setCaregiversLoading(true);
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
      } finally {
        if (active) setCaregiversLoading(false);
      }
    };
    void loadCaregivers();
    const interval = setInterval(() => { void loadCaregivers(); }, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [tab, token, reference, locationChecked]);

  const shownCaregivers = useMemo(
    () => token ? nearbyCaregivers : [],
    [nearbyCaregivers, token],
  );
  const specialties = useMemo(
    () => [...new Set(shownCaregivers.flatMap((caregiver) => caregiver.specialties).filter(Boolean))],
    [shownCaregivers],
  );
  const selectedSpecialty = activeSpecialty === 'Todas' || specialties.includes(activeSpecialty)
    ? activeSpecialty
    : 'Todas';
  const directoryHasRatings = shownCaregivers.some((caregiver) =>
    caregiver.reviews > 0 && Number.parseFloat(caregiver.rating) > 0);
  const directorySortOptions: CaregiverSort[] = directoryHasRatings
    ? ['rating', 'distance', 'price']
    : ['distance', 'price'];
  const activeDirectorySort = directorySortOptions.includes(caregiverSort)
    ? caregiverSort
    : directorySortOptions[0];
  const directoryCaregivers = useMemo(() => shownCaregivers
    .filter((caregiver) => selectedSpecialty === 'Todas' || caregiver.specialties.includes(selectedSpecialty))
    .slice()
    .sort((a, b) => {
      if (activeDirectorySort === 'rating') {
        const ratingDifference = Number.parseFloat(b.rating) - Number.parseFloat(a.rating);
        if (Number.isFinite(ratingDifference) && ratingDifference !== 0) return ratingDifference;
        return b.reviews - a.reviews;
      }
      if (activeDirectorySort === 'price') {
        const aPrice = a.hourlyRate > 0 ? a.hourlyRate : Number.POSITIVE_INFINITY;
        const bPrice = b.hourlyRate > 0 ? b.hourlyRate : Number.POSITIVE_INFINITY;
        return aPrice - bPrice;
      }
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    }), [activeDirectorySort, selectedSpecialty, shownCaregivers]);
  const directoryCardWidth = windowWidth < 360
    ? windowWidth - 38
    : Math.max(145, Math.floor((windowWidth - 50) / 2));
  const directorySortLabel = activeDirectorySort === 'rating'
    ? 'Mejor valorados'
    : activeDirectorySort === 'price'
      ? 'Menor tarifa'
      : 'Más cercanos';
  const cycleDirectorySort = () => {
    const activeIndex = directorySortOptions.indexOf(activeDirectorySort);
    setCaregiverSort(directorySortOptions[(activeIndex + 1) % directorySortOptions.length]);
  };
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
                    <Search color={profilePalette.primary} size={18} strokeWidth={1.8} />
                    <Text style={styles.familyActionText}>Buscar cuidadores</Text>
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
        ) : tab === 'care' ? null : (
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
        <View style={styles.searchDirectory}>
          <View style={styles.specialtyFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Todas', ...specialties].map((specialty) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedSpecialty === specialty }}
                key={specialty}
                onPress={() => setActiveSpecialty(specialty)}
                style={[styles.specialtyChip, selectedSpecialty === specialty && styles.specialtyChipActive]}
              >
                <Text style={[styles.specialtyChipText, selectedSpecialty === specialty && styles.specialtyChipTextActive]}>
                  {specialty}
                </Text>
              </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.directorySortRow}>
            <Text style={styles.directoryResultCount}>
              {directoryCaregivers.length} {directoryCaregivers.length === 1 ? 'cuidador' : 'cuidadores'}
            </Text>
            <Pressable
              accessibilityLabel={`Ordenar por ${directorySortLabel}`}
              accessibilityRole="button"
              onPress={cycleDirectorySort}
              style={styles.directorySortButton}
            >
              <Text style={styles.directorySortHint}>Ordenar</Text>
              <Text style={styles.directorySortText}>{directorySortLabel}</Text>
              <ChevronDown color={colors.teal} size={15} strokeWidth={2} />
            </Pressable>
          </View>

          {!token ? (
            <View style={styles.directoryEmpty}>
              <Text style={styles.directoryEmptyTitle}>Inicia sesión para ver cuidadores</Text>
              <Pressable onPress={() => onOpenAuth('login')} style={styles.directoryActionButton}>
                <Text style={styles.directoryActionText}>Iniciar sesión</Text>
              </Pressable>
            </View>
          ) : caregiversLoading && shownCaregivers.length === 0 ? (
            <ActivityIndicator color={colors.teal} style={styles.directoryLoading} />
          ) : nearbyError ? (
            <Text accessibilityRole="alert" style={styles.suggestionError}>{nearbyError}</Text>
          ) : directoryCaregivers.length === 0 ? (
            <View style={styles.directoryEmpty}>
              <Text style={styles.directoryEmptyTitle}>
                {shownCaregivers.length
                  ? 'No hay cuidadores en esta especialidad.'
                  : 'No hay cuidadores disponibles en tu zona por el momento.'}
              </Text>
              {!!reference && (
                <Text style={styles.suggestionInfo}>La lista se ordena según tu ubicación actual.</Text>
              )}
            </View>
          ) : (
            <View style={styles.caregiverGrid}>
              {directoryCaregivers.map((caregiver) => (
                <DirectoryCaregiverCard
                  caregiver={caregiver}
                  key={caregiver.id}
                  onPress={() => onSelectCaregiver(caregiver)}
                  width={directoryCardWidth}
                />
              ))}
            </View>
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

function DirectoryCaregiverCard({
  caregiver,
  width,
  onPress,
}: {
  caregiver: NearbyCaregiver;
  width: number;
  onPress: () => void;
}) {
  const initials = caregiver.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const hasRating = caregiver.reviews > 0 && Number.parseFloat(caregiver.rating) > 0;

  return (
    <Pressable
      accessibilityLabel={`Ver perfil de ${caregiver.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.directoryCard, { width }, pressed && styles.directoryCardPressed]}
    >
      <View style={styles.directoryPhoto}>
        <Text style={styles.directoryInitials}>{initials || 'C'}</Text>
        {caregiver.verified && (
          <View style={styles.directoryVerified}>
            <BadgeCheck color={colors.teal} size={19} strokeWidth={2} />
          </View>
        )}
      </View>
      <View style={styles.directoryCardBody}>
        <Text numberOfLines={1} style={styles.directoryName}>{caregiver.name}</Text>
        <Text numberOfLines={1} style={styles.directoryRole}>
          {caregiver.specialties[0] || caregiver.title}
        </Text>
        <View style={styles.directoryLocation}>
          <MapPin color={colors.muted} size={12} strokeWidth={1.8} />
          <Text numberOfLines={1} style={styles.directoryLocationText}>
            {caregiver.location === 'Zona de servicio' ? caregiver.distance : caregiver.location}
          </Text>
        </View>
        <View style={styles.directoryCardFooter}>
          {caregiver.hourlyRate > 0 ? (
            <Text style={styles.directoryPrice}>
              ${caregiver.hourlyRate}<Text style={styles.directoryPriceUnit}> / h</Text>
            </Text>
          ) : <View />}
          {hasRating ? (
            <View style={styles.directoryRating}>
              <Star color={colors.teal} fill={colors.teal} size={12} strokeWidth={1.7} />
              <Text style={styles.directoryRatingText}>
                {caregiver.rating} <Text style={styles.directoryReviews}>({caregiver.reviews})</Text>
              </Text>
            </View>
          ) : (
            <View style={styles.directoryAvailability}>
              <View style={[styles.directoryAvailabilityDot, caregiver.availabilityTone === 'amber' && styles.directoryAvailabilityBusy]} />
              <Text numberOfLines={1} style={styles.directoryAvailabilityText}>{caregiver.availability}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
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
  searchDirectory: { marginTop: 19 },
  specialtyFilters: { marginHorizontal: -2 },
  specialtyChip: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 17, borderWidth: 1, marginRight: 8, minHeight: 34, justifyContent: 'center', paddingHorizontal: 13 },
  specialtyChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  specialtyChipText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  specialtyChipTextActive: { color: colors.white },
  directorySortRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 11, marginTop: 14 },
  directoryResultCount: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  directorySortButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 34, paddingHorizontal: 10 },
  directorySortHint: { color: colors.muted, fontSize: 9 },
  directorySortText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  caregiverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  directoryCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 17, borderWidth: 1, marginBottom: 1, overflow: 'hidden' },
  directoryCardPressed: { opacity: 0.78 },
  directoryPhoto: { alignItems: 'center', backgroundColor: colors.tealPale, height: 132, justifyContent: 'center', position: 'relative' },
  directoryInitials: { color: colors.teal, fontSize: 34, fontWeight: '800' },
  directoryVerified: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, height: 28, justifyContent: 'center', position: 'absolute', right: 9, top: 9, width: 28 },
  directoryCardBody: { paddingHorizontal: 11, paddingBottom: 12, paddingTop: 10 },
  directoryName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  directoryRole: { color: colors.muted, fontSize: 9, marginTop: 4 },
  directoryLocation: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 7 },
  directoryLocationText: { color: colors.muted, flex: 1, fontSize: 9 },
  directoryCardFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, minHeight: 20 },
  directoryPrice: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  directoryPriceUnit: { color: colors.muted, fontSize: 9, fontWeight: '500' },
  directoryRating: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  directoryRatingText: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  directoryReviews: { color: colors.muted, fontSize: 8, fontWeight: '500' },
  directoryAvailability: { alignItems: 'center', flexDirection: 'row', gap: 5, maxWidth: '75%' },
  directoryAvailabilityDot: { backgroundColor: colors.secondary, borderRadius: 4, height: 7, width: 7 },
  directoryAvailabilityBusy: { backgroundColor: colors.line },
  directoryAvailabilityText: { color: colors.muted, fontSize: 8, fontWeight: '600' },
  directoryLoading: { marginVertical: 28 },
  directoryEmpty: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginBottom: 10, paddingHorizontal: 18, paddingVertical: 22 },
  directoryEmptyTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  directoryActionButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 12, marginTop: 14, minHeight: 40, justifyContent: 'center', paddingHorizontal: 18 },
  directoryActionText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  suggestionInfo: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  suggestionError: { color: colors.accent, fontSize: 11, lineHeight: 16, marginBottom: 10 },
}));
