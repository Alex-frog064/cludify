import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Bell, CalendarDays, ChevronRight, Clock3, LogOut, MapPin, Settings2, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';
import { ActivityIndicator,  Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type ScrollViewInstance, StyleSheet } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../components/LocalizedText';
import { CaregiverTabKey, TabKey } from '../components/BottomTabBar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ConsultasChat } from '../components/ConsultasChat';
import { EditableProfileAvatar } from '../components/EditableProfileAvatar';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import { ProfileScreen } from './ProfileScreen';
import { useAppSettings } from '../context/AppSettingsContext';
import { showLocalizedAlert } from '../utils/localizedAlert';
import { aceptarServicio, deleteCuidador, deleteServicio, deleteUsuario, getAbuelos, getConsultas, getCuidadores, getMensajesConsulta, getServicios, subirDocumentosVerificacion, updateCuidador, updateCuidadorDisponible, updateServicio, updateUsuario } from '../api/auth';
import { profilePalette, secondaryColors as colors , createThemedStyles} from '../theme';
import { getCurrentServiceLocation } from '../utils/currentServiceLocation';
import { mapServicio, matchesServicioFilter, matchesServicioSearch, servicioFilters, ServicioFilter } from '../utils/servicio';
import { Coordinates, Servicio, UserAccount } from '../types';

type Props = {
  tab: CaregiverTabKey;
  user: UserAccount;
  onSelectTab: (tab: TabKey) => void;
  onSaveLocation: (location: string, coordinates?: Coordinates) => Promise<void> | void;
  onUpdateUser: Dispatch<SetStateAction<UserAccount | null>>;
  onSignOut: () => void;
  onOpenConsulta: (consultaId: number) => void;
  onOpenPaciente: (abueloId: number, familiarNombre?: string, consultaId?: number) => void;
  onOpenClient: (familiarId: number, familiarNombre: string, consultaId: number) => void;
  activeUntil?: number | null;
  onAvailabilityChange?: (disponible: boolean) => void;
};

type NotificationCategory = 'Todas' | 'Cuenta' | 'Mensajes' | 'Servicios';
type NotificationItem = {
  id: string;
  category: Exclude<NotificationCategory, 'Todas'>;
  icon: string;
  title: string;
  body: string;
  time: string;
  target: TabKey;
  consultaId?: number;
  abueloId?: number;
  familiarId?: number;
  familiarNombre?: string;
};
type ProfileConfirmation = 'discardProfile' | 'removeProfile' | 'deleteAccount';

const categories: NotificationCategory[] = ['Todas', 'Cuenta', 'Mensajes', 'Servicios'];

function countUnanswered(mensajes: { emisor_id: number; emisor?: { rol?: string } }[], caregiverId: number) {
  let total = 0;
  for (let index = mensajes.length - 1; index >= 0; index -= 1) {
    const mensaje = mensajes[index];
    const rol = mensaje.emisor?.rol;
    if (mensaje.emisor_id === caregiverId || rol === 'cuidador' || rol === 'caregiver') break;
    total += 1;
  }
  return total;
}

function relativeTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function formatServiceDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function CaregiverWorkspaceScreen({ tab, user, onSelectTab, onSaveLocation, onUpdateUser, onSignOut, onOpenConsulta, onOpenPaciente, onOpenClient, activeUntil, onAvailabilityChange }: Props) {
  const { language } = useAppSettings();
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('Todas');
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [realNotifications, setRealNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationsRefreshKey, setNotificationsRefreshKey] = useState(0);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [unansweredConsultaIds, setUnansweredConsultaIds] = useState<number[]>([]);
  const [unansweredByConsulta, setUnansweredByConsulta] = useState<Record<number, number>>({});
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [serviciosLoading, setServiciosLoading] = useState(false);
  const [servicioError, setServicioError] = useState('');
  const [servicioFilter, setServicioFilter] = useState<ServicioFilter>('todos');
  const [servicioSearch, setServicioSearch] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSettingsVisible, setProfileSettingsVisible] = useState(false);
  const [profileConfirmation, setProfileConfirmation] = useState<ProfileConfirmation | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const profileScrollRef = useRef<ScrollViewInstance | null>(null);
  const locationSectionOffset = useRef(0);
  const [ineUri, setIneUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    name: user.name,
    phone: user.phone,
    identificationNumber: user.caregiverProfile?.identificationNumber ?? '',
    rfc: user.caregiverProfile?.rfc ?? '',
    professionalTitle: user.caregiverProfile?.professionalTitle ?? '',
    description: user.caregiverProfile?.description ?? '',
    yearsExperience: String(user.caregiverProfile?.yearsExperience ?? ''),
    hourlyRate: String(user.caregiverProfile?.hourlyRate ?? ''),
    specialties: (user.caregiverProfile?.specialties ?? []).join(', '),
    disponible: !!user.caregiverProfile?.disponible,
  });

  const openLocationSettings = () => {
    profileScrollRef.current?.scrollTo({ y: locationSectionOffset.current, animated: true });
  };

  const confirmSignOut = () => {
    showLocalizedAlert(language, 'Cerrar sesión', '¿Quieres cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: onSignOut },
    ]);
  };


  const pickVerificationImage = async (kind: 'ine' | 'selfie', source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setVerificationError('Necesitas permiso de cámara para tomar la foto.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      if (kind === 'ine') setIneUri(result.assets[0].uri);
      else setSelfieUri(result.assets[0].uri);
      setVerificationError('');
    } catch (e) {
      setVerificationError(e instanceof Error ? e.message : 'No se pudo seleccionar la imagen.');
    }
  };

  const askVerificationImage = (kind: 'ine' | 'selfie') => {
    showLocalizedAlert(
      language,
      kind === 'ine' ? 'Foto de tu INE' : 'Foto de tu selfie',
      'Elige cómo quieres agregar la imagen.',
      [
        { text: 'Tomar foto', onPress: () => { void pickVerificationImage(kind, 'camera'); } },
        { text: 'Elegir de galería', onPress: () => { void pickVerificationImage(kind, 'library'); } },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const submitVerification = async () => {
    const cuidadorId = user.caregiverProfile?.apiId;
    if (!cuidadorId) {
      setVerificationError('No se encontró tu perfil de cuidador en el servidor.');
      return;
    }
    if (!ineUri || !selfieUri) {
      setVerificationError('Selecciona la foto de tu INE y tu selfie.');
      return;
    }
    setVerificationSaving(true);
    setVerificationError('');
    try {
      await subirDocumentosVerificacion(
        cuidadorId,
        { uri: ineUri, name: 'ine.jpg', type: 'image/jpeg' },
        { uri: selfieUri, name: 'selfie.jpg', type: 'image/jpeg' },
        user.token,
      );
      setVerificationSent(true);
      showLocalizedAlert(language, 'Documentos enviados', 'Tu verificación quedó en revisión. No podrás activarte hasta que sea aprobada.');
    } catch (e) {
      setVerificationError(e instanceof Error ? e.message : 'No se pudieron subir los documentos.');
    } finally {
      setVerificationSaving(false);
    }
  };

  const saveCaregiverProfile = async () => {
    if (!user.id) {
      setProfileError('No se encontró el ID de tu cuenta. Vuelve a iniciar sesión e intenta de nuevo.');
      return;
    }
    if (!user.caregiverProfile) return;
    setProfileSaving(true); setProfileError('');
    try {
      let caregiverId = user.caregiverProfile.apiId;
      if (!caregiverId) {
        const caregivers = await getCuidadores(user.token);
        const found = caregivers.find((item) => Number(item.usuario_id) === user.id);
        const foundId = Number(found?.id);
        if (Number.isFinite(foundId) && foundId > 0) caregiverId = foundId;
      }
      if (!caregiverId) {
        throw new Error('No se encontró tu perfil de cuidador en el servidor.');
      }

      const payload = {
        cedula: profileDraft.identificationNumber.trim(),
        titulo: profileDraft.professionalTitle.trim(),
        rfc: profileDraft.rfc.trim().toUpperCase(),
        descripcion: profileDraft.description.trim(),
        anios_experiencia: Number(profileDraft.yearsExperience || 0),
        tarifa_hora: Number(profileDraft.hourlyRate || 0),
        especialidades: profileDraft.specialties.split(',').map((s) => s.trim()).filter(Boolean).join(', '),
        verificado: user.caregiverProfile.verificado === true,
      };
      await updateCuidador(caregiverId, payload, user.token);

      const name = profileDraft.name.trim();
      const phone = profileDraft.phone.trim();
      if (name !== user.name || phone !== user.phone) {
        await updateUsuario(user.id, { nombre: name, telefono: phone }, user.token);
      }

      onUpdateUser({
        ...user,
        name,
        phone,
        caregiverProfile: {
          ...user.caregiverProfile,
          apiId: caregiverId,
          identificationNumber: payload.cedula,
          professionalTitle: payload.titulo,
          rfc: payload.rfc,
          description: payload.descripcion,
          yearsExperience: payload.anios_experiencia,
          hourlyRate: payload.tarifa_hora,
          specialties: payload.especialidades ? payload.especialidades.split(',').map((s) => s.trim()) : [],
          disponible: profileDraft.disponible,
        },
      });
      if (profileDraft.disponible !== user.caregiverProfile.disponible) {
        onAvailabilityChange?.(profileDraft.disponible);
      }
      setProfileEditing(false);
    } catch (e) { setProfileError(e instanceof Error ? e.message : 'No se pudo actualizar.'); }
    finally { setProfileSaving(false); }
  };

  const removeCaregiverProfile = async () => {
    if (!user.caregiverProfile?.apiId) { setProfileError('No se encontró el cuidador en API.'); return; }
    setProfileSaving(true); setProfileError('');
    try {
      await deleteCuidador(user.caregiverProfile.apiId, user.token);
      onSignOut();
    } catch (e) { setProfileError(e instanceof Error ? e.message : 'No se pudo eliminar.'); }
    finally { setProfileSaving(false); }
  };

  const deleteAccount = async () => {
    if (!user.id) { setProfileError('No se encontró la cuenta.'); return; }
    setProfileSaving(true); setProfileError('');
    try {
      if (user.caregiverProfile?.apiId) {
        try { await deleteCuidador(user.caregiverProfile.apiId, user.token); } catch { /* continuar con cuenta */ }
      }
      await deleteUsuario(user.id, user.token);
      onSignOut();
    } catch (e) { setProfileError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.'); }
    finally { setProfileSaving(false); }
  };

  const startEditingProfile = () => {
    setProfileDraft({
      name: user.name,
      phone: user.phone,
      identificationNumber: user.caregiverProfile?.identificationNumber ?? '',
      rfc: user.caregiverProfile?.rfc ?? '',
      professionalTitle: user.caregiverProfile?.professionalTitle ?? '',
      description: user.caregiverProfile?.description ?? '',
      yearsExperience: String(user.caregiverProfile?.yearsExperience ?? ''),
      hourlyRate: String(user.caregiverProfile?.hourlyRate ?? ''),
      specialties: (user.caregiverProfile?.specialties ?? []).join(', '),
      disponible: !!user.caregiverProfile?.disponible,
    });
    setProfileError('');
    setProfileEditing(true);
  };

  const confirmProfileAction = async () => {
    if (!profileConfirmation) return;
    if (profileConfirmation === 'discardProfile') {
      setProfileEditing(false);
    } else if (profileConfirmation === 'removeProfile') {
      await removeCaregiverProfile();
    } else if (profileConfirmation === 'deleteAccount') {
      await deleteAccount();
    }
    setProfileConfirmation(null);
  };

  const loadServicios = async () => {
    if (!user.id) return;
    setServiciosLoading(true);
    setServicioError('');
    try {
      const cuidadorId = user.caregiverProfile?.apiId;
      if (!cuidadorId) {
        setServicios([]);
        setServicioError('No se encontró tu perfil de cuidador en el servidor.');
        return;
      }
      const [data, abuelos] = await Promise.all([
        getServicios(user.token),
        getAbuelos(user.token).catch(() => [] as Record<string, unknown>[]),
      ]);
      const patientNames = new Map<number, string>();
      abuelos.forEach((item) => {
        const id = Number(item.id);
        if (id) patientNames.set(id, String(item.nombre ?? `Paciente ${id}`));
      });
      const mine = data
        .map(mapServicio)
        .filter((r) => r.cuidador_id === cuidadorId)
        .map((r) => ({ ...r, abuelo_nombre: patientNames.get(r.abuelo_id) ?? r.abuelo_nombre }));
      setServicios(mine);
    } catch (e) {
      setServicioError(e instanceof Error ? e.message : 'No se pudieron cargar servicios.');
    } finally {
      setServiciosLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'clients') return;
    const timeout = setTimeout(() => { void loadServicios(); }, 0);
    return () => clearTimeout(timeout);
  }, [tab, user.id, user.token]);

  useEffect(() => {
    if ((tab !== 'notifications' && tab !== 'messages') || !user.token) return;
    let active = true;
    const load = async () => {
      setNotificationsLoading(true);
      setNotificationsError('');
      try {
        const [consultas, abuelos, servicios] = await Promise.all([
          getConsultas(user.token),
          getAbuelos(user.token).catch(() => [] as Record<string, unknown>[]),
          getServicios(user.token).catch(() => [] as Record<string, unknown>[]),
        ]);
        const patientNames = new Map<number, string>();
        abuelos.forEach((item) => {
          const id = Number(item.id);
          if (id) patientNames.set(id, String(item.nombre ?? `Paciente ${id}`));
        });
        const pendingByConsulta: Record<number, number> = {};
        let pendingTotal = 0;
        await Promise.all(consultas.map(async (consulta) => {
          const consultaId = Number(consulta.consulta_id);
          if (!consultaId) return;
          try {
            const mensajes = await getMensajesConsulta(consultaId, user.token);
            const pending = user.id == null ? 0 : countUnanswered(mensajes, user.id);
            if (pending > 0) {
              pendingByConsulta[consultaId] = pending;
              pendingTotal += pending;
            }
          } catch {}
        }));
        const items: NotificationItem[] = [];

        if (user.caregiverProfile?.verificado) {
          items.push({
            id: 'verificacion-aprobada',
            category: 'Cuenta',
            icon: '✓',
            title: 'Cuenta autorizada',
            body: 'Tu verificación fue aprobada. Ya puedes activar tu disponibilidad.',
            time: '',
            target: 'profile',
          });
        }

        consultas.forEach((consulta) => {
          const consultaId = Number(consulta.consulta_id);
          const familiarNombre = consulta.familiar?.nombre ?? 'Una familia';
          const unread = Number(consulta.no_leidos ?? 0);
          const pending = pendingByConsulta[consultaId] ?? 0;
          items.push({
            id: `consulta-${consultaId}`,
            category: 'Mensajes',
            icon: '○',
            title: pending ? 'Mensaje sin contestar' : unread ? 'Mensaje nuevo' : 'Conversación iniciada',
            body: pending
              ? `${familiarNombre} lleva ${pending} mensaje${pending === 1 ? '' : 's'} sin contestar${unread ? ` (${unread} sin leer)` : ''}.`
              : unread
                ? `${familiarNombre} tiene ${unread} mensaje${unread === 1 ? '' : 's'} sin leer.`
                : `${familiarNombre} inició una conversación contigo.`,
            time: relativeTime(consulta.actualizado_en ?? consulta.creado_en),
            target: 'messages',
            consultaId,
            familiarId: consulta.familiar?.id,
            familiarNombre,
          });
        });

        servicios
          .filter((item) =>
            user.caregiverProfile?.apiId != null &&
            Number(item.cuidador_id) === user.caregiverProfile.apiId)
          .forEach((item) => {
            const abueloId = Number(item.abuelo_id);
            const nombre = patientNames.get(abueloId) ?? String(item.abuelos && typeof item.abuelos === 'object' && 'nombre' in item.abuelos ? String(item.abuelos.nombre) : `Paciente ${abueloId}`);
            const pendiente = !item.aceptado_por_cuidador;
            items.push({
              id: `servicio-${String(item.id)}`,
              category: 'Servicios',
              icon: '▣',
              title: pendiente ? 'Solicitud de servicio' : 'Servicio confirmado',
              body: `${nombre} · ${String(item.estado ?? 'activo')} · ${pendiente ? 'Pendiente de tu aceptación' : 'Aceptado por ti'}`,
              time: relativeTime(String(item.creado_en ?? item.inicio ?? '')),
              target: 'clients',
              abueloId,
            });
          });

        if (active) {
          setRealNotifications(items);
          setUnansweredCount(pendingTotal);
          setUnansweredConsultaIds(Object.keys(pendingByConsulta).map(Number));
          setUnansweredByConsulta(pendingByConsulta);
        }
      } catch (e) {
        if (active) setNotificationsError(e instanceof Error ? e.message : 'No se pudieron cargar tus avisos.');
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => { void load(); }, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tab, user.token, user.id, user.caregiverProfile?.verificado, user.caregiverProfile?.apiId, notificationsRefreshKey]);
  const acceptServicioRequest = async (id: number) => {
    setServicioError('');
    try {
      await aceptarServicio(id, user.token);
      await loadServicios();
      setNotificationsRefreshKey((key) => key + 1);
      showLocalizedAlert(language, 'Servicio aceptado', 'El chat de la cita ya está disponible para ambas partes.');
    } catch (e) {
      setServicioError(e instanceof Error ? e.message : 'No se pudo aceptar el servicio.');
    }
  };

  const rejectServicioRequest = async (id: number) => {
    setServicioError('');
    try {
      await updateServicio(id, { estado: 'cancelado' }, user.token);
      await loadServicios();
      setNotificationsRefreshKey((key) => key + 1);
      showLocalizedAlert(language, 'Servicio rechazado', 'La solicitud quedó cancelada.');
    } catch (e) {
      setServicioError(e instanceof Error ? e.message : 'No se pudo rechazar el servicio.');
    }
  };

  const deleteServicioRequest = async (id: number) => {
    setServicioError('');
    try {
      await deleteServicio(id, user.token);
      await loadServicios();
      setNotificationsRefreshKey((key) => key + 1);
    } catch (e) {
      setServicioError(e instanceof Error ? e.message : 'No se pudo eliminar el servicio.');
    }
  };

  const shownServicios = servicios
    .filter((item) => matchesServicioFilter(item, servicioFilter))
    .filter((item) => matchesServicioSearch(item, servicioSearch));

  return (
    <View style={styles.screen}>
      {tab === 'notifications' && (
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          <Text style={styles.pageTitle}>Notificaciones</Text>
          <Text style={styles.subtitle}>Solicitudes, opiniones y novedades de tu perfil.</Text>
          {!user.caregiverProfile?.verificado && (
            <Pressable onPress={() => onSelectTab('profile')} style={styles.verificationBanner}>
              <Text style={styles.verificationBannerTitle}>Verificación pendiente</Text>
              <Text style={styles.verificationBannerText}>
                No puedes activarte ni aparecer en el mapa hasta verificar tu cuenta. Sube tu INE y selfie en Perfil.
              </Text>
              <Text style={styles.verificationBannerAction}>Ir a verificar →</Text>
            </Pressable>
          )}
          {verificationSent && user.caregiverProfile?.verificado !== true && (
            <Text style={styles.verificationReviewText}>Documentos enviados. Tu verificación está en revisión.</Text>
          )}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>N</Text></View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>{unansweredCount ? `${unansweredCount} mensaje${unansweredCount === 1 ? '' : 's'} sin contestar` : 'Tienes novedades'}</Text>
              <Text style={styles.summarySubtitle}>{unansweredConsultaIds.length ? `${unansweredConsultaIds.length} conversación${unansweredConsultaIds.length === 1 ? '' : 'es'} esperando tu respuesta.` : 'Revisa lo que está pasando con tu perfil.'}</Text>
            </View>
            <View style={styles.countBadge}><Text style={styles.countText}>{realNotifications.length}</Text></View>
          </View>
          {unansweredCount > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSelectedCategory('Mensajes');
                if (unansweredConsultaIds.length) onOpenConsulta(unansweredConsultaIds[0]);
              }}
              style={styles.pendingBanner}
            >
              <Text style={styles.pendingBannerTitle}>{unansweredCount} mensaje{unansweredCount === 1 ? '' : 's'} sin contestar</Text>
              <Text style={styles.pendingBannerText}>{unansweredConsultaIds.length} conversación{unansweredConsultaIds.length === 1 ? '' : 'es'} · Toca para responder</Text>
            </Pressable>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller}>
            {categories.map((category) => (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[styles.categoryChip, selectedCategory === category && styles.selectedCategoryChip]}
              >
                <Text style={[styles.categoryText, selectedCategory === category && styles.selectedCategoryText]}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.sectionEyebrow}>RECIENTES</Text>
          {notificationsLoading ? <ActivityIndicator color={colors.tealDark} style={{ marginTop: 12 }} /> : null}
          {!!notificationsError && <Text style={styles.locationError}>{notificationsError}</Text>}
          {!notificationsLoading && realNotifications.length === 0 && (
            <Text style={styles.demoNote}>Todavía no hay avisos para mostrar.</Text>
          )}
          {realNotifications
            .filter((item) => selectedCategory === 'Todas' || item.category === selectedCategory)
            .map((item) => {
              const isRead = readNotifications.includes(item.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => {
                    setReadNotifications((current) => current.includes(item.id) ? current : [...current, item.id]);
                    if (item.consultaId) onOpenConsulta(item.consultaId);
                    else if (item.abueloId) onOpenPaciente(item.abueloId, item.familiarNombre);
                    else onSelectTab(item.target);
                  }}
                  style={[styles.notificationCard, !isRead && styles.unreadCard]}
                >
                  <View style={styles.notificationIcon}>
                    <Text style={styles.notificationIconText}>{item.icon}</Text>
                  </View>
                  <View style={styles.notificationCopy}>
                    <View style={styles.notificationTitleLine}>
                      <Text style={styles.notificationTitle}>{item.title}</Text>
                      {!isRead && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationBody}>{item.body}</Text>
                    <Text style={styles.notificationMeta}>{item.category}{item.time ? ` · ${item.time}` : ''}</Text>
                  </View>
                </Pressable>
              );
            })}
        </ScrollView>
      )}

      {tab === 'messages' && (
        <ConsultasChat
          token={user.token}
          currentUserId={user.id}
          viewerRole="caregiver"
          onOpenClient={onOpenClient}
          unansweredCount={unansweredCount}
          unansweredConsultaIds={unansweredConsultaIds}
          unansweredByConsulta={unansweredByConsulta}
          onMessagesChanged={() => setNotificationsRefreshKey((key) => key + 1)}
        />
      )}

      {tab === 'clients' && (
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          <Text style={styles.pageTitle}>Mis solicitudes</Text>
          <Text style={styles.subtitle}>Busca, acepta o rechaza las solicitudes de las familias.</Text>
          <TextInput
            onChangeText={setServicioSearch}
            placeholder="Buscar por paciente, nota, estado o ID"
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
          {serviciosLoading ? <ActivityIndicator color={colors.tealDark} style={{ marginTop: 12 }} /> : null}
          {servicioError ? <Text style={styles.locationError}>{servicioError}</Text> : null}
          {!serviciosLoading && servicios.length === 0 && <Text style={styles.demoNote}>No tienes solicitudes de servicio todavía.</Text>}
          {!serviciosLoading && servicios.length > 0 && shownServicios.length === 0 && <Text style={styles.demoNote}>No hay servicios con ese filtro o búsqueda.</Text>}
          {shownServicios.map((s) => (
            <View key={s.id} style={styles.detailsCard}>
              <View style={styles.serviceTopLine}>
                <Text style={styles.sectionTitle}>{s.abuelo_nombre ?? `Paciente ${s.abuelo_id}`}</Text>
                <Text style={styles.serviceStatus}>{s.estado}</Text>
              </View>
              <Text style={styles.detailText}>Servicio #{s.id} · Solicitud de {s.cuidador_nombre ?? 'una familia'}</Text>
              <Text style={styles.profileDescription}>{s.nota || 'Sin nota'}</Text>
              <Text style={styles.profileDescription}>{formatServiceDate(s.inicio)} → {formatServiceDate(s.fin)}</Text>
              <Text style={styles.profileDescription}>${s.tarifa_hora}/h · Total ${s.total} · Comisión ${s.comision}</Text>
              <Text style={styles.serviceMeta}>
                Pago: {s.estado_pago} · Familiar: {s.aceptado_por_familiar ? 'aceptó' : 'pendiente'} · Tú: {s.aceptado_por_cuidador ? 'aceptaste' : 'pendiente'}
              </Text>
              <View style={styles.serviceActions}>
                <Pressable onPress={() => onOpenPaciente(s.abuelo_id)} style={styles.messageAction}><Text style={styles.messageActionText}>Ver paciente</Text></Pressable>
                {!s.aceptado_por_cuidador && s.estado === 'activo' && (
                  <Pressable onPress={() => void acceptServicioRequest(s.id)} style={styles.acceptButton}>
                    <Text style={styles.acceptButtonText}>Aceptar</Text>
                  </Pressable>
                )}
                {!s.aceptado_por_cuidador && s.estado === 'activo' && (
                  <Pressable onPress={() => void rejectServicioRequest(s.id)} style={styles.rejectButton}>
                    <Text style={styles.rejectButtonText}>Rechazar</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => void deleteServicioRequest(s.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {tab === 'profile' && user.caregiverProfile && (
        <ScrollView ref={profileScrollRef} contentContainerStyle={styles.profilePage} showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          <View style={styles.profileScreenHeader}>
            <Text style={styles.profileScreenTitle}>Perfil</Text>
          </View>
          <View style={styles.profileHero}>
            <View style={styles.profileIdentityRow}>
              <EditableProfileAvatar
                uri={user.profilePhotoUri}
                name={user.name}
                size={72}
                onChange={(uri) => onUpdateUser((current) =>
                  current && current.email === user.email ? { ...current, profilePhotoUri: uri } : current)}
              />
              <View style={styles.profileIdentityCopy}>
                <Text style={styles.profileDisplayName}>{user.name}</Text>
                <Text style={styles.profileDisplaySubtitle}>{user.caregiverProfile.professionalTitle || 'Cuidador profesional'}</Text>
                <Text numberOfLines={1} style={styles.profileContact}>{user.email}</Text>
                {!!user.phone && <Text style={styles.profileContact}>{user.phone}</Text>}
                <View style={styles.profileBadges}>
                  <View style={styles.profileRoleBadge}>
                    <Text style={styles.profileRoleBadgeText}>Cuidador</Text>
                  </View>
                  <View style={[styles.profileVerificationBadge, user.caregiverProfile.verificado && styles.profileVerificationBadgeVerified]}>
                    {user.caregiverProfile.verificado ? (
                      <ShieldCheck color={profilePalette.primary} size={14} strokeWidth={1.8} />
                    ) : (
                      <Clock3 color={profilePalette.secondary} size={14} strokeWidth={1.8} />
                    )}
                    <Text style={styles.profileVerificationBadgeText}>
                      {user.caregiverProfile.verificado ? 'Verificado' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.profileStats}>
              <ProfileStat value={`${user.caregiverProfile.yearsExperience}`} label="Años exp." />
              <View style={styles.profileStatDivider} />
              <ProfileStat value={`$${user.caregiverProfile.hourlyRate}`} label="MXN / hora" />
              <View style={styles.profileStatDivider} />
              <ProfileStat value={`${user.caregiverProfile.specialties.length}`} label="Especialidades" />
            </View>
            <Text style={styles.profileSchedule}>
              Disponibilidad: {user.caregiverProfile.availability.days.join(', ') || 'Por definir'}
            </Text>
            <View style={styles.profileIdentityDetails}>
              <View style={styles.profileIdentityDetail}>
                <Text style={styles.profileIdentityLabel}>Cédula</Text>
                <Text style={styles.profileIdentityValue}>{user.caregiverProfile.identificationNumber || 'Sin registrar'}</Text>
              </View>
              <View style={styles.profileIdentityDetail}>
                <Text style={styles.profileIdentityLabel}>RFC</Text>
                <Text style={styles.profileIdentityValue}>{user.caregiverProfile.rfc || 'Sin registrar'}</Text>
              </View>
            </View>
            {!!user.caregiverProfile.description && (
              <Text style={styles.caregiverProfileDescription}>{user.caregiverProfile.description}</Text>
            )}
            {!!user.caregiverProfile.specialties.length && (
              <View style={styles.specialties}>
                {user.caregiverProfile.specialties.map((specialty, index) => (
                  <Text key={`${specialty}-${index}`} style={styles.specialtyChip}>{specialty}</Text>
                ))}
              </View>
            )}
            <View style={styles.profileAvailability}>
              <View style={[styles.profileAvailabilityDot, profileDraft.disponible && user.caregiverProfile.verificado && styles.profileAvailabilityDotOn]} />
              <View style={styles.profileAvailabilityCopy}>
                <Text style={styles.profileAvailabilityTitle}>
                  {profileDraft.disponible && user.caregiverProfile.verificado ? 'Disponible para recibir servicios' : 'No disponible'}
                </Text>
                <Text style={styles.profileAvailabilityHint}>
                  {!user.caregiverProfile.verificado
                    ? 'Completa tu verificación para activarte'
                    : profileDraft.disponible && activeUntil
                      ? 'Apareces en el mapa y cercanos · se desactiva a los 30 minutos'
                      : 'Enciéndelo para aparecer en el mapa y en cercanos'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: profileDraft.disponible && !!user.caregiverProfile.verificado }}
                onPress={() => {
                  if (!user.caregiverProfile?.verificado) {
                    showLocalizedAlert(
                      language,
                      'Verificación requerida',
                      'No puedes estar activo si tu cuenta no está verificada. Sube tu INE y selfie en esta misma pantalla.',
                    );
                    return;
                  }
                  const next = !profileDraft.disponible;
                  setProfileDraft((d) => ({ ...d, disponible: next }));
                  onUpdateUser({ ...user, caregiverProfile: { ...user.caregiverProfile!, disponible: next } });
                  onAvailabilityChange?.(next);
                  if (!user.caregiverProfile?.apiId) return;
                  setProfileError('');
                  void (async () => {
                    try { await updateCuidadorDisponible(user.caregiverProfile!.apiId!, next, user.token); }
                    catch (e) { setProfileError(e instanceof Error ? e.message : 'No se pudo actualizar disponibilidad, se reintentará al guardar.'); }
                  })();
                }}
                style={[styles.switchTrack, profileDraft.disponible && styles.switchTrackOn, !user.caregiverProfile.verificado && styles.switchTrackDisabled]}
              >
                <View style={[styles.switchThumb, profileDraft.disponible && styles.switchThumbOn]} />
              </Pressable>
            </View>
            {profileError ? <Text style={styles.locationError}>{profileError}</Text> : null}
          </View>

          {!user.caregiverProfile.verificado && (
            <View style={[styles.detailsCard, styles.profileSectionCard]}>
            <View style={styles.profileSectionHeading}>
              <View>
                <Text style={styles.profileSectionTitle}>Verificación</Text>
                <Text style={styles.profileSectionHint}>Identidad segura para las familias</Text>
              </View>
              <View style={styles.verificationStateBadge}>
                <Text style={styles.verificationStateText}>Pendiente</Text>
              </View>
            </View>
            <Text style={styles.caregiverProfileDescription}>
              Sube una foto clara de tu INE y un selfie para que un administrador revise tu cuenta. Mientras tanto no puedes estar activo.
            </Text>
            <View style={styles.verificationRow}>
              <Pressable onPress={() => askVerificationImage('ine')} style={styles.verificationPick}>
                {ineUri ? <Image resizeMode="contain" source={{ uri: ineUri }} style={styles.verificationPreview} /> : <Text style={styles.verificationPickText}>Seleccionar INE</Text>}
              </Pressable>
              <Pressable onPress={() => askVerificationImage('selfie')} style={styles.verificationPick}>
                {selfieUri ? <Image resizeMode="contain" source={{ uri: selfieUri }} style={styles.verificationPreview} /> : <Text style={styles.verificationPickText}>Seleccionar selfie</Text>}
              </Pressable>
            </View>
            {verificationSent && <Text style={styles.verificationReviewText}>Documentos enviados. Estamos en revisión.</Text>}
            {!!verificationError && <Text style={styles.locationError}>{verificationError}</Text>}
            <Pressable
              disabled={verificationSaving}
              onPress={() => { void submitVerification(); }}
              style={styles.saveLocationButton}
            >
              <Text style={styles.saveLocationText}>
                {verificationSaving ? 'Enviando...' : verificationSent ? 'Volver a enviar documentos' : 'Enviar documentos'}
              </Text>
            </Pressable>
            </View>
          )}

          <View style={[styles.detailsCard, styles.profileSectionCard]}>
            <Text style={styles.profileSectionTitle}>Tu cuenta</Text>
            <Pressable accessibilityRole="button" onPress={startEditingProfile} style={styles.profileMenuRow}>
              <View style={styles.profileMenuIcon}><UserRound color={profilePalette.primary} size={20} strokeWidth={1.8} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuTitle}>Editar perfil</Text>
                <Text style={styles.profileMenuSubtitle}>{user.email} · {user.phone || 'Agrega tu teléfono'}</Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
          </View>

          <Text style={styles.profileGroupTitle}>Configuración</Text>
          <View style={[styles.detailsCard, styles.profileSectionCard]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelectTab('notifications')}
              style={styles.profileActionRow}
            >
              <View style={styles.profileMenuIcon}><Bell color={profilePalette.primary} size={19} strokeWidth={1.8} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuTitle}>Notificaciones</Text>
                <Text style={styles.profileMenuSubtitle}>Solicitudes y novedades de tu perfil</Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openLocationSettings} style={styles.profileActionRow}>
              <View style={styles.profileMenuIcon}><MapPin color={profilePalette.primary} size={19} strokeWidth={1.8} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuTitle}>Direcciones y ubicaciones</Text>
                <Text numberOfLines={1} style={styles.profileMenuSubtitle}>
                  {user.caregiverProfile.serviceLocation || 'Configura tu zona de servicio'}
                </Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setProfileSettingsVisible(true)}
              style={[styles.profileActionRow, styles.profileActionRowLast]}
            >
              <View style={styles.profileMenuIcon}><Settings2 color={profilePalette.primary} size={19} strokeWidth={1.8} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuTitle}>Preferencias y seguridad</Text>
                <Text style={styles.profileMenuSubtitle}>Apariencia, idioma y cuenta</Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
          </View>

          <Text style={styles.profileGroupTitle}>Preferencias</Text>
          <View style={[styles.detailsCard, styles.profileSectionCard]}>
            <Pressable accessibilityRole="button" onPress={() => onSelectTab('clients')} style={[styles.profileActionRow, styles.profileActionRowLast]}>
              <View style={styles.profileMenuIcon}><CalendarDays color={profilePalette.primary} size={19} strokeWidth={1.8} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuTitle}>Solicitudes y servicios</Text>
                <Text style={styles.profileMenuSubtitle}>Administra tus servicios con familias</Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
          </View>

          <Modal visible={profileEditing} animationType="fade" transparent onRequestClose={() => setProfileConfirmation('discardProfile')}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
              style={styles.modalKeyboardAvoiding}
            >
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                  <Text style={styles.profileModalTitle}>Editar información</Text>
                  <Text style={styles.profileModalSubtitle}>Actualiza los datos que ven las familias en tu perfil.</Text>
                  <TextInput style={styles.locationInput} placeholder="Nombre" value={profileDraft.name} onChangeText={(v) => setProfileDraft((d) => ({ ...d, name: v }))} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Teléfono" value={profileDraft.phone} onChangeText={(v) => setProfileDraft((d) => ({ ...d, phone: v }))} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Título profesional" value={profileDraft.professionalTitle} onChangeText={(v) => setProfileDraft((d) => ({ ...d, professionalTitle: v }))} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Cédula" value={profileDraft.identificationNumber} onChangeText={(v) => setProfileDraft((d) => ({ ...d, identificationNumber: v }))} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="RFC" value={profileDraft.rfc} onChangeText={(v) => setProfileDraft((d) => ({ ...d, rfc: v }))} autoCapitalize="characters" />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Descripción" value={profileDraft.description} onChangeText={(v) => setProfileDraft((d) => ({ ...d, description: v }))} multiline />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Años experiencia" keyboardType="numeric" value={profileDraft.yearsExperience} onChangeText={(v) => setProfileDraft((d) => ({ ...d, yearsExperience: v.replace(/\D/g, '') }))} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Tarifa hora" keyboardType="numeric" value={profileDraft.hourlyRate} onChangeText={(v) => setProfileDraft((d) => ({ ...d, hourlyRate: v.replace(/[^\d.]/g, '') }))} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Especialidades (coma)" value={profileDraft.specialties} onChangeText={(v) => setProfileDraft((d) => ({ ...d, specialties: v }))} />
                  {profileError ? <Text style={styles.locationError}>{profileError}</Text> : null}
                  <Pressable disabled={profileSaving} onPress={() => void saveCaregiverProfile()} style={styles.saveLocationButton}><Text style={styles.saveLocationText}>{profileSaving ? 'Guardando...' : 'Guardar cambios'}</Text></Pressable>
                  <Pressable disabled={profileSaving} onPress={() => setProfileConfirmation('discardProfile')} style={styles.signOutButton}><Text style={styles.signOutText}>Cancelar</Text></Pressable>
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <View onLayout={(event) => { locationSectionOffset.current = event.nativeEvent.layout.y; }}>
            <LocationEditor coordinates={user.caregiverProfile.serviceCoordinates} location={user.caregiverProfile.serviceLocation} onSave={onSaveLocation} />
          </View>

          <Text style={styles.profileGroupTitle}>Cuenta y sesión</Text>
          <View style={styles.accountActions}>
            <Pressable disabled={profileSaving} onPress={() => setProfileConfirmation('removeProfile')} style={styles.accountActionRow}>
              <View style={styles.accountActionLeading}>
                <Trash2 color={profilePalette.primary} size={18} strokeWidth={1.8} />
                <Text style={styles.accountActionTextDanger}>{profileSaving ? 'Eliminando perfil...' : 'Eliminar perfil de cuidador'}</Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
            <Pressable disabled={profileSaving} onPress={() => setProfileConfirmation('deleteAccount')} style={styles.accountActionRow}>
              <View style={styles.accountActionLeading}>
                <Trash2 color={profilePalette.primary} size={18} strokeWidth={1.8} />
                <Text style={styles.accountActionTextDanger}>{profileSaving ? 'Eliminando cuenta...' : 'Eliminar cuenta'}</Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
            <Pressable onPress={confirmSignOut} style={[styles.accountActionRow, styles.accountSignOut]}>
              <View style={styles.accountActionLeading}>
                <LogOut color={profilePalette.primary} size={18} strokeWidth={1.8} />
                <Text style={styles.accountActionText}>Cerrar sesión</Text>
              </View>
              <ChevronRight color={profilePalette.neutral} size={20} strokeWidth={1.8} />
            </Pressable>
          </View>
          <ProfileScreen
            onClose={() => setProfileSettingsVisible(false)}
            onEditProfile={startEditingProfile}
            onOpenAppointments={() => onSelectTab('clients')}
            onOpenLocations={openLocationSettings}
            onOpenTab={onSelectTab}
            onSignOut={onSignOut}
            user={user}
            visible={profileSettingsVisible}
          />
          <ConfirmationModal
            visible={!!profileConfirmation}
            title={profileConfirmation === 'removeProfile'
              ? '¿Eliminar perfil de cuidador?'
              : profileConfirmation === 'deleteAccount'
                ? '¿Eliminar tu cuenta?'
                : '¿Descartar cambios?'}
            message={profileConfirmation === 'removeProfile'
              ? 'Se eliminará tu perfil de cuidador y ya no aparecerá en la plataforma.'
              : profileConfirmation === 'deleteAccount'
                ? 'Esta acción eliminará tu cuenta y no se puede deshacer.'
                : 'Se cerrará el formulario y se perderán los cambios que no hayas guardado.'}
            confirmLabel={profileConfirmation === 'removeProfile' || profileConfirmation === 'deleteAccount' ? 'Sí, eliminar' : 'Descartar'}
            destructive={profileConfirmation === 'removeProfile' || profileConfirmation === 'deleteAccount'}
            loading={profileSaving && (profileConfirmation === 'removeProfile' || profileConfirmation === 'deleteAccount')}
            onCancel={() => setProfileConfirmation(null)}
            onConfirm={() => { void confirmProfileAction(); }}
          />
        </ScrollView>
      )}
    </View>
  );
}

function LocationEditor({
  coordinates: initialCoordinates,
  location,
  onSave,
}: {
  coordinates?: Coordinates;
  location: string;
  onSave: (location: string, coordinates?: Coordinates) => void;
}) {
  const [value, setValue] = useState(location);
  const [error, setError] = useState('');
  const [coordinates, setCoordinates] = useState(initialCoordinates);
  const [isLocating, setIsLocating] = useState(false);
  const [expanded, setExpanded] = useState(!initialCoordinates);

  const useCurrentLocation = async () => {
    setIsLocating(true);
    setError('');
    try {
      const result = await getCurrentServiceLocation();
      if (!result.granted) {
        setError('Permite el acceso a tu ubicación para mostrarla en el mapa.');
        return;
      }
      setValue(result.label || value);
      setCoordinates(result.coordinates);
      setExpanded(false);
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'No se pudo obtener la ubicación actual.');
    } finally {
      setIsLocating(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    const nextLocation = value.trim();
    if (!coordinates) {
      setError('Usa tu ubicación actual para colocar el pin en el mapa.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(nextLocation || 'Ubicación actual', coordinates);
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la ubicación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.locationCard}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.locationHeading}>
        <View style={styles.locationIcon}><View style={styles.pinOuter}><View style={styles.pinInner} /></View></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Zona de servicio</Text>
          <Text style={styles.locationHint}>{coordinates ? (value || 'Ubicación actual seleccionada') : 'Muestra tu ubicación actual en el mapa y guárdala.'}</Text>
        </View>
        <Text style={styles.useLocationText}>{expanded ? 'Ocultar' : 'Editar'}</Text>
      </Pressable>

      {expanded ? (
        <>
          <Pressable disabled={isLocating} onPress={useCurrentLocation} style={styles.useLocationButton}>
            <Text style={styles.useLocationText}>{isLocating ? 'Buscando ubicación...' : 'Usar mi ubicación actual'}</Text>
          </Pressable>
          {coordinates ? (
            <View style={styles.mapPreview}>
              <OpenStreetMapView
                center={coordinates}
                markers={[{ id: 'me', label: value || 'Mi ubicación', rate: 'Zona de servicio', latitude: coordinates.latitude, longitude: coordinates.longitude }]}
                showCurrentLocation
              />
            </View>
          ) : (
            <Text style={styles.coordinatesNote}>Aún no has seleccionado tu ubicación en el mapa.</Text>
          )}
          <TextInput
            accessibilityLabel="Ubicación del cuidador"
            onChangeText={(text) => { setValue(text); setError(''); }}
            placeholder="Etiqueta de tu zona (opcional)"
            placeholderTextColor={colors.line}
            style={styles.locationInput}
            value={value}
          />
          {!!error && <Text accessibilityRole="alert" style={styles.locationError}>{error}</Text>}
          <Pressable disabled={saving} onPress={() => void save()} style={styles.saveLocationButton}>
            <Text style={styles.saveLocationText}>{saving ? 'Guardando...' : 'Guardar ubicación'}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function ProfileStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  contentScroll: { flex: 1 },
  page: { paddingHorizontal: 19, paddingTop: 24, paddingBottom: 48 },
  profilePage: { backgroundColor: profilePalette.canvas, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120 },
  profileScreenHeader: { marginBottom: 14 },
  profileScreenTitle: { color: profilePalette.ink, fontSize: 24, fontWeight: '800' },
  pageTitle: { color: colors.tealDark, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  profileModalTitle: { color: profilePalette.ink, fontSize: 22, fontWeight: '800' },
  profileModalSubtitle: { color: profilePalette.secondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  profileHero: { backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, marginBottom: 13, padding: 15 },
  profileIdentityRow: { alignItems: 'flex-start', flexDirection: 'row' },
  profileIdentityCopy: { flex: 1, marginLeft: 12, minWidth: 0 },
  profileDisplayName: { color: profilePalette.ink, fontSize: 17, fontWeight: '800' },
  profileDisplaySubtitle: { color: profilePalette.secondary, fontSize: 11, marginTop: 3 },
  profileContact: { color: profilePalette.ink, fontSize: 10, marginTop: 4 },
  profileBadges: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  profileRoleBadge: { backgroundColor: profilePalette.primary, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  profileRoleBadgeText: { color: profilePalette.white, fontSize: 9, fontWeight: '700' },
  profileVerificationBadge: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 12, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  profileVerificationBadgeVerified: { backgroundColor: profilePalette.light },
  profileVerificationBadgeText: { color: profilePalette.primary, fontSize: 9, fontWeight: '700' },
  profileStats: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 13, flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingVertical: 11 },
  profileStat: { alignItems: 'center', flex: 1 },
  profileStatValue: { color: profilePalette.ink, fontSize: 16, fontWeight: '800' },
  profileStatLabel: { color: profilePalette.primary, fontSize: 9, marginTop: 4, textAlign: 'center' },
  profileStatDivider: { backgroundColor: profilePalette.neutral, height: 30, width: 1 },
  profileSchedule: { color: profilePalette.primary, fontSize: 10, lineHeight: 15, marginTop: 10 },
  profileIdentityDetails: { borderColor: profilePalette.neutral, borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginTop: 10, paddingHorizontal: 10, paddingVertical: 9 },
  profileIdentityDetail: { flex: 1, minWidth: 0, paddingRight: 7 },
  profileIdentityLabel: { color: profilePalette.secondary, fontSize: 9, fontWeight: '700' },
  profileIdentityValue: { color: profilePalette.ink, fontSize: 10, marginTop: 3 },
  caregiverProfileDescription: { color: profilePalette.primary, fontSize: 10, lineHeight: 15, marginTop: 10 },
  profileAvailability: { alignItems: 'center', backgroundColor: profilePalette.canvas, borderRadius: 12, flexDirection: 'row', marginTop: 12, paddingHorizontal: 11, paddingVertical: 10 },
  profileAvailabilityDot: { backgroundColor: profilePalette.neutral, borderRadius: 5, height: 10, width: 10 },
  profileAvailabilityDotOn: { backgroundColor: profilePalette.primary },
  profileAvailabilityCopy: { flex: 1, marginLeft: 9 },
  profileAvailabilityTitle: { color: profilePalette.ink, fontSize: 11, fontWeight: '800' },
  profileAvailabilityHint: { color: profilePalette.secondary, fontSize: 9, lineHeight: 13, marginTop: 3 },
  summaryCard: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 16, flexDirection: 'row', marginTop: 19, padding: 14 },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  summaryIconText: { color: colors.tealDark, fontSize: 23 },
  summaryCopy: { flex: 1, marginLeft: 11 },
  summaryTitle: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  summarySubtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
  countBadge: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 13, height: 26, justifyContent: 'center', width: 26 },
  countText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  pendingBanner: { backgroundColor: colors.highlightSoft, borderRadius: 14, marginTop: 10, padding: 12 },
  pendingBannerTitle: { color: colors.tealDark, fontSize: 11, fontWeight: '800' },
  pendingBannerText: { color: colors.ink, fontSize: 9, marginTop: 4 },
  categoryScroller: { flexGrow: 0, marginBottom: 22, marginTop: 17 },
  categoryChip: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 17, borderWidth: 1, marginRight: 7, paddingHorizontal: 12, paddingVertical: 8 },
  selectedCategoryChip: { backgroundColor: colors.teal, borderColor: colors.tealDark },
  categoryText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  selectedCategoryText: { color: colors.white },
  sectionEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 9 },
  notificationCard: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginBottom: 9, padding: 14 },
  unreadCard: { borderColor: colors.tealPale },
  notificationIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  notificationIconText: { color: colors.tealDark, fontSize: 18, fontWeight: '800' },
  reviewIcon: { backgroundColor: colors.highlightSoft },
  reviewIconText: { color: colors.ink },
  notificationCopy: { flex: 1, marginLeft: 10 },
  notificationTitleLine: { alignItems: 'center', flexDirection: 'row' },
  notificationTitle: { color: colors.tealDark, flex: 1, fontSize: 11, fontWeight: '800' },
  unreadDot: { backgroundColor: colors.teal, borderRadius: 4, height: 7, marginLeft: 5, width: 7 },
  notificationBody: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  notificationMeta: { color: colors.tealDark, fontSize: 9, fontWeight: '600', marginTop: 7 },
  demoNote: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 13, textAlign: 'center' },
  conversationCard: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 14 },
  conversationCopy: { flex: 1, marginLeft: 11 },
  conversationTitleLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  conversationName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  conversationTime: { color: colors.muted, fontSize: 9 },
  conversationPreview: { color: colors.muted, fontSize: 10, marginTop: 5 },
  conversationPlace: { color: colors.tealDark, fontSize: 9, marginTop: 4 },
  chatScreen: { backgroundColor: colors.canvas, flex: 1 },
  chatHeader: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  chatBack: { alignItems: 'center', height: 38, justifyContent: 'center', marginRight: 7, width: 29 },
  chatBackText: { color: colors.ink, fontSize: 30, lineHeight: 34, marginTop: -4 },
  chatHeaderCopy: { flex: 1, marginLeft: 9 },
  chatName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  chatStatus: { color: colors.muted, fontSize: 9, marginTop: 3 },
  chatContent: { alignItems: 'flex-start', flexGrow: 1, paddingHorizontal: 16, paddingVertical: 18 },
  chatDate: { alignSelf: 'center', color: colors.muted, fontSize: 9, fontWeight: '700', marginBottom: 18 },
  messageBubble: { backgroundColor: colors.surface, borderRadius: 15, borderBottomLeftRadius: 4, marginBottom: 10, maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 10 },
  ownMessage: { alignSelf: 'flex-end', backgroundColor: colors.teal, borderBottomLeftRadius: 15, borderBottomRightRadius: 4 },
  messageText: { color: colors.ink, fontSize: 11, lineHeight: 16 },
  ownMessageText: { color: colors.white },
  composer: { alignItems: 'center', backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 9 },
  composerInput: { backgroundColor: colors.canvas, borderRadius: 20, color: colors.ink, flex: 1, fontSize: 11, height: 40, paddingHorizontal: 14 },
  sendButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 20, height: 38, justifyContent: 'center', marginLeft: 8, width: 38 },
  sendButtonText: { color: colors.white, fontSize: 19, fontWeight: '700' },
  contactSummary: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.tealPale, borderRadius: 13, flexDirection: 'row', marginVertical: 18, paddingHorizontal: 13, paddingVertical: 9 },
  contactSummaryNumber: { color: colors.tealDark, fontSize: 15, fontWeight: '800' },
  contactSummaryText: { color: colors.tealDark, fontSize: 10, marginLeft: 7 },
  clientCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginBottom: 10, padding: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.tealDark, fontWeight: '800' },
  clientCopy: { flex: 1, marginLeft: 10 },
  clientName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  clientRelationship: { color: colors.muted, fontSize: 9, marginTop: 4 },
  clientLocation: { color: colors.tealDark, fontSize: 9, marginTop: 5 },
  messageAction: { backgroundColor: colors.tealPale, borderRadius: 15, marginLeft: 7, paddingHorizontal: 10, paddingVertical: 8 },
  messageActionText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  locationCard: { backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, marginTop: 13, padding: 15 },
  locationHeading: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  locationIcon: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 18, height: 36, justifyContent: 'center', marginRight: 9, width: 36 },
  pinOuter: { alignItems: 'center', backgroundColor: profilePalette.primary, borderRadius: 8, height: 16, justifyContent: 'center', width: 16 },
  pinInner: { backgroundColor: profilePalette.surface, borderRadius: 3, height: 6, width: 6 },
  sectionTitle: { color: profilePalette.ink, fontSize: 13, fontWeight: '700' },
  locationHint: { color: profilePalette.secondary, fontSize: 10, marginTop: 3 },
  locationInput: { backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 10, borderWidth: 1, color: profilePalette.ink, fontSize: 12, minHeight: 43, paddingHorizontal: 11, paddingVertical: 10 },
  useLocationButton: { alignSelf: 'flex-start', backgroundColor: profilePalette.light, borderRadius: 10, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8 },
  useLocationText: { color: profilePalette.primary, fontSize: 10, fontWeight: '700' },
  mapPreview: { borderRadius: 12, height: 190, marginTop: 10, overflow: 'hidden' },
  coordinatesNote: { color: profilePalette.secondary, fontSize: 10, marginTop: 7 },
  locationError: { color: profilePalette.primary, fontSize: 10, marginTop: 6 },
  saveLocationButton: { alignItems: 'center', backgroundColor: profilePalette.primary, borderRadius: 10, marginTop: 9, minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 10 },
  saveLocationText: { color: profilePalette.white, fontSize: 11, fontWeight: '800' },
  detailsCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 14 },
  serviceSearch: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 11, marginTop: 14, paddingHorizontal: 11, paddingVertical: 9 },
  serviceFilters: { flexGrow: 0, marginBottom: 10, marginTop: 10 },
  serviceFilterChip: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginRight: 7, paddingHorizontal: 11, paddingVertical: 7 },
  serviceFilterChipActive: { backgroundColor: colors.teal, borderColor: colors.tealDark },
  serviceFilterText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  serviceFilterTextActive: { color: colors.white },
  serviceTopLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  serviceStatus: { backgroundColor: colors.highlightSoft, borderRadius: 9, color: colors.ink, fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  serviceMeta: { color: colors.tealDark, fontSize: 9, lineHeight: 13, marginTop: 7 },
  serviceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  acceptButton: { backgroundColor: colors.teal, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 8 },
  acceptButtonText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  rejectButton: { backgroundColor: colors.highlightSoft, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 8 },
  rejectButtonText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  deleteButton: { backgroundColor: colors.tealPale, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 8 },
  deleteButtonText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  profileSectionCard: { borderColor: profilePalette.neutral, borderRadius: 16, marginTop: 13, padding: 15 },
  profileSectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profileSectionTitle: { color: profilePalette.ink, fontSize: 13, fontWeight: '700' },
  profileSectionHint: { color: profilePalette.secondary, fontSize: 10, marginTop: 3 },
  profileGroupTitle: { color: profilePalette.secondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 18 },
  verificationStateBadge: { backgroundColor: profilePalette.light, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  verificationStateText: { color: profilePalette.primary, fontSize: 9, fontWeight: '800' },
  profileMenuRow: { alignItems: 'center', flexDirection: 'row', marginTop: 9, minHeight: 52, paddingVertical: 5 },
  profileActionRow: { alignItems: 'center', borderBottomColor: profilePalette.neutral, borderBottomWidth: 1, flexDirection: 'row', minHeight: 56, paddingVertical: 7 },
  profileActionRowLast: { borderBottomWidth: 0 },
  profileMenuIcon: { alignItems: 'center', backgroundColor: profilePalette.light, borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  profileMenuCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  profileMenuTitle: { color: profilePalette.ink, fontSize: 13, fontWeight: '700' },
  profileMenuSubtitle: { color: profilePalette.secondary, fontSize: 10, marginTop: 4 },
  accountActions: { backgroundColor: profilePalette.surface, borderColor: profilePalette.neutral, borderRadius: 16, borderWidth: 1, marginTop: 13, paddingHorizontal: 13 },
  accountActionRow: { alignItems: 'center', borderBottomColor: profilePalette.neutral, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 },
  accountActionLeading: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minWidth: 0 },
  accountSignOut: { backgroundColor: profilePalette.light, borderBottomWidth: 0, borderRadius: 12, marginBottom: 9, marginTop: 8, minHeight: 48, paddingHorizontal: 10 },
  accountActionText: { color: profilePalette.ink, fontSize: 13, fontWeight: '700' },
  accountActionTextDanger: { color: profilePalette.primary, flexShrink: 1, fontSize: 12, fontWeight: '700' },
  profileDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  detailText: { color: colors.tealDark, fontSize: 10, fontWeight: '700', marginTop: 7 },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  specialtyChip: { backgroundColor: profilePalette.light, borderRadius: 11, color: profilePalette.primary, fontSize: 9, marginBottom: 5, marginRight: 5, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 6 },
  signOutButton: { alignItems: 'center', borderColor: profilePalette.neutral, borderRadius: 12, borderWidth: 1, marginTop: 14, paddingVertical: 12 },
  signOutText: { color: profilePalette.primary, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { alignItems: 'center', backgroundColor: profilePalette.ink, flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 24 },
  modalKeyboardAvoiding: { flex: 1 },
  modalCard: { backgroundColor: profilePalette.surface, borderRadius: 16, maxHeight: '90%', maxWidth: 520, width: '100%' },
  modalContent: { padding: 20, paddingBottom: 28 },
  switchTrack: { width: 48, height: 28, borderRadius: 14, backgroundColor: profilePalette.neutral, padding: 2 },
  switchTrackOn: { backgroundColor: profilePalette.primary },
  switchTrackDisabled: { opacity: 0.45 },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: profilePalette.surface },
  switchThumbOn: { marginLeft: 20 },
  verificationBanner: { backgroundColor: colors.highlightSoft, borderColor: colors.gold, borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 13 },
  verificationBannerTitle: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  verificationBannerText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  verificationBannerAction: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 8 },
  verificationReviewText: { color: profilePalette.primary, fontSize: 10, fontWeight: '700', marginTop: 9 },
  verificationRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  verificationPick: { alignItems: 'center', backgroundColor: profilePalette.canvas, borderColor: profilePalette.neutral, borderRadius: 12, borderWidth: 1, flex: 1, height: 96, justifyContent: 'center', overflow: 'hidden' },
  verificationPickText: { color: profilePalette.primary, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  verificationPreview: { height: 96, width: '100%' },
}));
