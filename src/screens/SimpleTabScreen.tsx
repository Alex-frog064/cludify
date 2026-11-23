import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteServicio, deleteUsuario, getAbuelos, getServicios } from '../api/auth';
import { CaregiverCard } from '../components/CaregiverCard';
import { ClientProfileSection } from '../components/ClientProfileSection';
import { ConsultasChat } from '../components/ConsultasChat';
import { FamilyTabKey, TabKey } from '../components/BottomTabBar';
import { colors } from '../theme';
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
    title: 'Mensajes',
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
  onSaveCareRecipient,
  onDeleteCareRecipient,
  onSelectCaregiver,
  onEditServicio,
  servicioRefreshKey,
  activeConsultaId,
  onActiveConsultaChange,
}: Props) {
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
      Alert.alert('No se pudo eliminar', e instanceof Error ? e.message : 'Intenta de nuevo.');
    }
  };

  const shownCaregivers = token ? nearbyCaregivers : [];

  const deleteAccount = async () => {
    if (!signedInUser) return;
    if (!signedInUser.id) { onSignOut(); return; }
    try {
      await deleteUsuario(signedInUser.id, signedInUser.token);
      onSignOut();
    } catch (e) {
      Alert.alert('No se pudo eliminar la cuenta', e instanceof Error ? e.message : 'Intenta de nuevo.');
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

  return (
    <ScrollView contentContainerStyle={tab === 'account' && signedInUser?.role === 'family' ? styles.familyScreen : styles.screen}>
      {!(tab === 'account' && signedInUser?.role === 'family') && (
        <>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </>
      )}

      {tab === 'account' ? (
        signedInUser ? (
          signedInUser.role === 'family' ? (
            <View style={styles.familyProfile}>
              <FamilyProfileHero user={signedInUser} recipientCount={signedInUser.careRecipients?.length ?? 0} />
              <View style={styles.familyRecipients}>
                <ClientProfileSection
                  profiles={signedInUser.careRecipients ?? []}
                  familiarId={signedInUser.id}
                  token={signedInUser.token}
                  onDelete={onDeleteCareRecipient}
                  onSave={onSaveCareRecipient}
                />
              </View>
              <View style={styles.familyActions}>
                <Pressable accessibilityRole="button" onPress={() => void deleteAccount()} style={styles.familyAction}>
                  <Text style={styles.familyActionDanger}>Eliminar cuenta</Text>
                  <Text style={styles.familyActionArrow}>›</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.familyAction}>
                  <Text style={styles.familyActionText}>Cerrar sesión</Text>
                  <Text style={styles.familyActionArrow}>›</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.accountCard}>
              <View style={styles.profileHero}>
                {signedInUser.profilePhotoUri ? (
                  <Image source={{ uri: signedInUser.profilePhotoUri }} style={styles.heroAvatar} />
                ) : (
                  <View style={styles.heroAvatar}>
                    <Text style={styles.avatarText}>{signedInUser.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.profileIdentity}>
                  <Text style={styles.profileEyebrow}>PERFIL</Text>
                  <Text style={styles.welcome}>{signedInUser.name}</Text>
                  <Text style={styles.accountContact}>{signedInUser.email}</Text>
                  {!!signedInUser.phone && <Text style={styles.accountContact}>{signedInUser.phone}</Text>}
                </View>
              </View>
              {signedInUser.caregiverProfile ? (
              <>
                <Text style={styles.cardText}>
                  {signedInUser.caregiverProfile.professionalTitle} · {signedInUser.caregiverProfile.yearsExperience} años de experiencia
                </Text>
                <Text style={styles.profileDetails}>
                  ${signedInUser.caregiverProfile.hourlyRate} MXN/h · {signedInUser.caregiverProfile.availability.days.join(', ')}
                </Text>
              </>
              ) : (
                <Text style={styles.cardText}>Tu sesión es solo de demostración y no está conectada a un servicio.</Text>
              )}
              <Pressable onPress={() => void deleteAccount()} style={styles.outlineButton}>
                <Text style={styles.outlineText}>Eliminar cuenta</Text>
              </Pressable>
              <Pressable onPress={onSignOut} style={styles.outlineButton}>
                <Text style={styles.outlineText}>Cerrar sesión</Text>
              </Pressable>
            </View>
          )
        ) : (
          <View style={styles.accountCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>U</Text></View>
            <Text style={styles.welcome}>Cuidado con confianza</Text>
            <Text style={styles.cardText}>Inicia sesión o crea una cuenta para organizar el cuidado de tu familia.</Text>
            <Pressable onPress={() => onOpenAuth('login')} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Iniciar sesión</Text>
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
            placeholderTextColor="#91A0A3"
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
    </ScrollView>
  );
}

function FamilyProfileHero({ user, recipientCount }: { user: UserAccount; recipientCount: number }) {
  return (
    <View style={styles.familyHero}>
      <View style={styles.familyTopLine}>
        <View style={styles.familyTopBadge}><Text style={styles.familyTopBadgeText}>♡</Text></View>
      </View>
      <View style={styles.familyPortrait}>
        <View style={styles.familyPortraitRing}>
          {user.profilePhotoUri ? (
            <Image source={{ uri: user.profilePhotoUri }} style={styles.familyPortraitImage} />
          ) : (
            <Text style={styles.familyPortraitInitial}>{user.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
      </View>
      <View style={styles.familySummaryCard}>
        <View style={styles.familyNameLine}>
          <View style={styles.familyNameCopy}>
            <Text style={styles.familyEyebrow}>CUENTA FAMILIAR</Text>
            <Text style={styles.familyDisplayName}>{user.name}</Text>
            <Text style={styles.familyDisplaySubtitle}>{user.email}</Text>
            {!!user.phone && <Text style={styles.familyDisplaySubtitle}>{user.phone}</Text>}
          </View>
          <View style={styles.familyRoleBadge}>
            <Text style={styles.familyRoleBadgeText}>Familia</Text>
          </View>
        </View>
        <View style={styles.familyStats}>
          <FamilyStat value={String(recipientCount)} label="Personas mayores" />
          <View style={styles.familyStatDivider} />
          <FamilyStat value={user.phone ? 'Sí' : '—'} label="Teléfono" />
          <View style={styles.familyStatDivider} />
          <FamilyStat value={user.id ? 'Activa' : 'Demo'} label="Cuenta" />
        </View>
        <View style={styles.familyCareHint}>
          <Text style={styles.familyCareHintIcon}>♡</Text>
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

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flexGrow: 1, paddingHorizontal: 19, paddingTop: 30, paddingBottom: 26 },
  familyScreen: { backgroundColor: '#F0F1F7', flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30 },
  familyProfile: { flex: 1 },
  familyHero: { backgroundColor: '#ECEEF6', borderRadius: 25, marginHorizontal: -16, marginTop: -12, paddingHorizontal: 16, paddingTop: 13 },
  familyTopLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' },
  familyTopBadge: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 22, height: 42, justifyContent: 'center', width: 42 },
  familyTopBadgeText: { color: colors.tealDark, fontSize: 22, fontWeight: '700' },
  familyPortrait: { alignItems: 'center', marginTop: 8, zIndex: 1 },
  familyPortraitRing: { alignItems: 'center', backgroundColor: colors.white, borderColor: '#CDE7E8', borderRadius: 54, borderWidth: 4, height: 108, justifyContent: 'center', overflow: 'hidden', width: 108 },
  familyPortraitImage: { height: 100, width: 100 },
  familyPortraitInitial: { color: colors.tealDark, fontSize: 40, fontWeight: '800' },
  familySummaryCard: { backgroundColor: colors.white, borderColor: '#E8E8EF', borderRadius: 24, borderWidth: 1, marginBottom: 17, marginTop: -38, paddingHorizontal: 17, paddingTop: 51, paddingBottom: 16, shadowColor: '#24283D', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 3 },
  familyNameLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  familyNameCopy: { flex: 1, paddingRight: 8 },
  familyEyebrow: { color: colors.tealDark, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  familyDisplayName: { color: '#252631', fontSize: 17, fontWeight: '800', marginTop: 3 },
  familyDisplaySubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  familyRoleBadge: { backgroundColor: '#292A34', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7 },
  familyRoleBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  familyStats: { alignItems: 'center', backgroundColor: '#F7F7FA', borderRadius: 17, flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingVertical: 12 },
  familyStat: { alignItems: 'center', flex: 1 },
  familyStatValue: { color: '#292A34', fontSize: 16, fontWeight: '800' },
  familyStatLabel: { color: colors.muted, fontSize: 8, marginTop: 4, textAlign: 'center' },
  familyStatDivider: { backgroundColor: '#E3E4EA', height: 30, width: 1 },
  familyCareHint: { alignItems: 'center', backgroundColor: '#292A34', borderRadius: 15, flexDirection: 'row', marginTop: 13, paddingHorizontal: 12, paddingVertical: 10 },
  familyCareHintIcon: { color: colors.white, fontSize: 21, marginRight: 9 },
  familyCareHintCopy: { flex: 1 },
  familyCareHintTitle: { color: colors.white, fontSize: 10, fontWeight: '800' },
  familyCareHintText: { color: '#D5D5DC', fontSize: 9, lineHeight: 13, marginTop: 3 },
  familyRecipients: { alignSelf: 'stretch' },
  familyActions: { backgroundColor: colors.white, borderColor: '#E8E8EF', borderRadius: 20, borderWidth: 1, marginTop: 14, paddingHorizontal: 15 },
  familyAction: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  familyActionText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  familyActionDanger: { color: '#B64B47', fontSize: 10, fontWeight: '700' },
  familyActionArrow: { color: '#7C818D', fontSize: 24 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  accountCard: { alignItems: 'stretch', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 22, borderWidth: 1, marginTop: 25, overflow: 'hidden', padding: 18 },
  profileHero: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 18, flexDirection: 'row', padding: 16 },
  heroAvatar: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  profileIdentity: { flex: 1, marginLeft: 13 },
  profileEyebrow: { color: colors.tealDark, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  avatar: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 31, height: 62, justifyContent: 'center', width: 62 },
  avatarText: { color: colors.tealDark, fontSize: 27, fontWeight: '700' },
  welcome: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 4, textAlign: 'left' },
  roleBadge: { backgroundColor: colors.tealPale, borderRadius: 12, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText: { color: colors.tealDark, fontSize: 10, fontWeight: '700' },
  accountContact: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: 'left' },
  cardText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  profileDetails: { color: colors.tealDark, fontSize: 11, fontWeight: '700', marginTop: 8 },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.teal, borderRadius: 13, marginTop: 18, paddingVertical: 13 },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  outlineButton: { alignItems: 'center', alignSelf: 'stretch', borderColor: colors.line, borderRadius: 13, borderWidth: 1, marginTop: 10, paddingVertical: 12 },
  outlineText: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, marginTop: 25, padding: 22 },
  emptyIcon: { color: colors.teal, fontSize: 31 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  suggestions: { marginTop: 23 },
  suggestionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  serviceSearch: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 11, marginBottom: 9, paddingHorizontal: 11, paddingVertical: 9 },
  serviceFilters: { flexGrow: 0, marginBottom: 10 },
  serviceFilterChip: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginRight: 7, paddingHorizontal: 11, paddingVertical: 7 },
  serviceFilterChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  serviceFilterText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  serviceFilterTextActive: { color: colors.white },
  serviceCard: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 14, borderWidth: 1, marginBottom: 9, padding: 12 },
  serviceTopLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  serviceTitle: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: '800' },
  serviceStatus: { backgroundColor: colors.tealPale, borderRadius: 9, color: colors.tealDark, fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  serviceInfo: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  serviceNote: { color: colors.ink, fontSize: 10, lineHeight: 14, marginTop: 7 },
  serviceMeta: { color: colors.tealDark, fontSize: 9, lineHeight: 13, marginTop: 7 },
  serviceActions: { flexDirection: 'row', gap: 8, marginTop: 9 },
  serviceAction: { backgroundColor: colors.tealPale, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  serviceActionText: { color: colors.tealDark, fontSize: 9, fontWeight: '800' },
  serviceActionDanger: { backgroundColor: '#FDECEC' },
  serviceActionDangerText: { color: '#B23B3B', fontSize: 9, fontWeight: '800' },
  suggestionInfo: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  suggestionError: { color: '#B3261E', fontSize: 11, lineHeight: 16, marginBottom: 10 },
});
