import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { deleteUsuario, getCuidadoresMapa } from '../api/auth';
import { CaregiverCard } from '../components/CaregiverCard';
import { ClientProfileSection } from '../components/ClientProfileSection';
import { FamilyTabKey, TabKey } from '../components/BottomTabBar';
import { colors } from '../theme';
import { CareRecipient, Caregiver, Coordinates, UserAccount } from '../types';
import { getCurrentCoordinates } from '../utils/currentServiceLocation';
import { filterNearbyCaregivers, mapCaregiver, nearbyRadiusKm } from '../utils/nearbyCaregivers';
import type { NearbyCaregiver } from '../utils/nearbyCaregivers';

type Props = {
  tab: FamilyTabKey;
  signedInUser: UserAccount | null;
  onSelectTab: (tab: TabKey) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onSignOut: () => void;
  onBecomeCaregiver?: () => void;
  onSaveCareRecipient: (recipient: CareRecipient) => void | Promise<void>;
  onDeleteCareRecipient: (recipientId: string) => void | Promise<void>;
  onSelectCaregiver: (caregiver: Caregiver) => void;
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
  onBecomeCaregiver,
  onSaveCareRecipient,
  onDeleteCareRecipient,
  onSelectCaregiver,
}: Props) {
  const content = copy[tab];
  const token = signedInUser?.token;
  const [confirmCaregiver, setConfirmCaregiver] = useState(false);
  const [reference, setReference] = useState<Coordinates | null>(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [nearbyCaregivers, setNearbyCaregivers] = useState<NearbyCaregiver[]>([]);
  const [nearbyError, setNearbyError] = useState('');

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
        const data = await getCuidadoresMapa(token);
        if (!active) return;
        setNearbyCaregivers(
          filterNearbyCaregivers(data.map(mapCaregiver).filter((c): c is NearbyCaregiver => !!c), reference),
        );
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
  const shownCaregivers = token ? nearbyCaregivers : [];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.subtitle}>{content.subtitle}</Text>

      {tab === 'account' ? (
        signedInUser ? (
          <View style={styles.accountCard}>
            {signedInUser.profilePhotoUri ? (
              <Image source={{ uri: signedInUser.profilePhotoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{signedInUser.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.welcome}>Hola, {signedInUser.name}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{signedInUser.role === 'caregiver' ? 'Perfil de cuidador' : 'Cuenta familiar'}</Text>
            </View>
            <Text style={styles.accountContact}>{signedInUser.email}</Text>
            {!!signedInUser.phone && <Text style={styles.accountContact}>{signedInUser.phone}</Text>}
            {signedInUser.caregiverProfile ? (
              <>
                <Text style={styles.cardText}>
                  {signedInUser.caregiverProfile.professionalTitle} · {signedInUser.caregiverProfile.yearsExperience} años de experiencia
                </Text>
                <Text style={styles.profileDetails}>
                  ${signedInUser.caregiverProfile.hourlyRate} MXN/h · {signedInUser.caregiverProfile.availability.days.join(', ')}
                </Text>
              </>
            ) : signedInUser.role === 'family' ? (
              <>
                <Text style={styles.cardText}>Tu cuenta familiar está lista para organizar el cuidado.</Text>
                <ClientProfileSection
                  profiles={signedInUser.careRecipients ?? []}
                  familiarId={signedInUser.id}
                  token={signedInUser.token}
                  onDelete={onDeleteCareRecipient}
                  onSave={onSaveCareRecipient}
                />
                <Pressable
                  onPress={() => {
                    if (!signedInUser.id) {
                      Alert.alert('Sesión requerida', 'Inicia sesión nuevamente para convertir tu cuenta.');
                      return;
                    }
                    if (signedInUser.caregiverProfile) { onBecomeCaregiver?.(); return; }
                    setConfirmCaregiver((v) => !v);
                  }}
                  style={styles.outlineButton}
                >
                  <Text style={styles.outlineText}>{signedInUser.caregiverProfile ? 'Ir a perfil de cuidador' : 'Convertirme en cuidador'}</Text>
                </Pressable>
                {confirmCaregiver && (
                  <View style={styles.convertBox}>
                    <Text style={styles.convertText}>Esto cambiará tu cuenta a cuidador y abrirá el registro.</Text>
                    <Pressable
                      onPress={() => {
                        setConfirmCaregiver(false);
                        onBecomeCaregiver?.();
                      }}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryText}>Continuar</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.cardText}>Tu sesión es solo de demostración y no está conectada a un servicio.</Text>
            )}
            <Pressable onPress={async () => {
              if (!signedInUser.id) { onSignOut(); return; }
              try { await deleteUsuario(signedInUser.id, signedInUser.token); onSignOut(); }
              catch (e) { Alert.alert('No se pudo eliminar la cuenta', e instanceof Error ? e.message : 'Intenta de nuevo.'); }
            }} style={styles.outlineButton}>
              <Text style={styles.outlineText}>Eliminar cuenta</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.outlineButton}>
              <Text style={styles.outlineText}>Cerrar sesión</Text>
            </Pressable>
          </View>
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
      ) : (
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
          <Text style={styles.suggestionTitle}>Cuidadores cerca de ti</Text>
          <Text style={styles.suggestionInfo}>
            {reference
              ? `Hasta ${nearbyRadiusKm} km desde tu ubicación`
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
                ? `No hay cuidadores activos a menos de ${nearbyRadiusKm} km. Deben estar verificados y con ubicación reciente (2 min).`
                : 'No hay cuidadores activos en el mapa. Activa la ubicación para filtrar por cercanía.'}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flexGrow: 1, paddingHorizontal: 19, paddingTop: 30, paddingBottom: 26 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  accountCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, marginTop: 25, padding: 22 },
  avatar: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 31, height: 62, justifyContent: 'center', width: 62 },
  avatarText: { color: colors.tealDark, fontSize: 27, fontWeight: '700' },
  welcome: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 13, textAlign: 'center' },
  roleBadge: { backgroundColor: colors.tealPale, borderRadius: 12, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText: { color: colors.tealDark, fontSize: 10, fontWeight: '700' },
  accountContact: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: 'center' },
  cardText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  profileDetails: { color: colors.tealDark, fontSize: 11, fontWeight: '700', marginTop: 8 },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.teal, borderRadius: 13, marginTop: 18, paddingVertical: 13 },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  outlineButton: { alignItems: 'center', alignSelf: 'stretch', borderColor: colors.line, borderRadius: 13, borderWidth: 1, marginTop: 10, paddingVertical: 12 },
  outlineText: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
  convertBox: { alignSelf: 'stretch', backgroundColor: colors.tealPale, borderRadius: 12, marginTop: 10, padding: 12 },
  convertText: { color: colors.ink, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  emptyCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, marginTop: 25, padding: 22 },
  emptyIcon: { color: colors.teal, fontSize: 31 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  suggestions: { marginTop: 23 },
  suggestionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  suggestionInfo: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  suggestionError: { color: '#B3261E', fontSize: 11, lineHeight: 16, marginBottom: 10 },
});
