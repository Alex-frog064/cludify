import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CaregiverTabKey, TabKey } from '../components/BottomTabBar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import { createServicio, deleteCuidador, deleteServicio, deleteUsuario, getCuidadores, getServicios, subirDocumentosVerificacion, updateCuidador, updateCuidadorDisponible, updateServicio, updateUsuario } from '../api/auth';
import { colors } from '../theme';
import { getCurrentServiceLocation } from '../utils/currentServiceLocation';
import { Coordinates, Servicio, UserAccount } from '../types';

type Props = {
  tab: CaregiverTabKey;
  user: UserAccount;
  onSelectTab: (tab: TabKey) => void;
  onSaveLocation: (location: string, coordinates?: Coordinates) => Promise<void> | void;
  onUpdateUser: (user: UserAccount) => void;
  onSignOut: () => void;
};

type NotificationCategory = 'Todas' | 'Solicitudes' | 'Opiniones' | 'Ofertas' | 'Mensajes';
type ProfileConfirmation = 'discardProfile' | 'removeProfile' | 'deleteAccount';

const categories: NotificationCategory[] = ['Todas', 'Solicitudes', 'Opiniones', 'Ofertas', 'Mensajes'];

const notifications: {
  id: string;
  category: Exclude<NotificationCategory, 'Todas'>;
  icon: string;
  title: string;
  body: string;
  time: string;
  target: TabKey;
}[] = [
  {
    id: 'request',
    category: 'Solicitudes',
    icon: '▣',
    title: 'Nueva solicitud de cuidado',
    body: 'Laura busca apoyo para su papá mañana en Del Valle.',
    time: 'Hace 12 min',
    target: 'clients',
  },
  {
    id: 'opinion',
    category: 'Opiniones',
    icon: '•',
    title: 'Recibiste una nueva opinión',
    body: '“María fue muy atenta y puntual. La recomendamos.”',
    time: 'Hace 2 h',
    target: 'profile',
  },
  {
    id: 'offer',
    category: 'Ofertas',
    icon: '•',
    title: 'Nueva oportunidad cerca de ti',
    body: 'Una familia en Narvarte necesita compañía este fin de semana.',
    time: 'Ayer',
    target: 'clients',
  },
  {
    id: 'message',
    category: 'Mensajes',
    icon: '○',
    title: 'Tienes un mensaje nuevo',
    body: 'Laura: Hola, ¿podrías contarme sobre tu experiencia?',
    time: 'Ayer',
    target: 'messages',
  },
];

const clients = [
  {
    id: 'laura',
    name: 'Laura Hernández',
    relationship: 'Hija de Roberto · solicita cuidado',
    location: 'Del Valle, CDMX',
    preview: 'Hola, quisiera conocer tu disponibilidad.',
    initials: 'LH',
    color: '#E8F4F2',
  },
  {
    id: 'andrea',
    name: 'Andrea Pérez',
    relationship: 'Familiar · contacto reciente',
    location: 'Narvarte, CDMX',
    preview: 'Muchas gracias por el acompañamiento.',
    initials: 'AP',
    color: '#FFF0E6',
  },
  {
    id: 'roberto',
    name: 'Roberto Castillo',
    relationship: 'Hijo de Elena · cliente',
    location: 'Nápoles, CDMX',
    preview: '¿Tienes espacio el viernes por la tarde?',
    initials: 'RC',
    color: '#E9EEFA',
  },
];

const initialMessages: Record<string, string[]> = {
  laura: [
    'Hola, vi tu perfil y me gustaría saber si estás disponible mañana.',
    '¡Hola! Sí, puedo platicarte de los horarios que tengo.',
  ],
  andrea: [
    'Gracias por acompañar a mi mamá esta semana.',
    'Con mucho gusto, fue un placer conocerla.',
  ],
  roberto: ['¿Tienes espacio el viernes por la tarde?'],
};

function toApiServicio(s: Servicio) {
  return {
    abuelo_id: s.abuelo_id,
    cuidador_id: s.cuidador_id,
    nota: s.nota,
    inicio: s.inicio,
    fin: s.fin,
    tarifa_hora: s.tarifa_hora,
    total: s.total,
    comision: s.comision,
    estado: s.estado,
    estado_pago: s.estado_pago,
  };
}

function emptyServicio(cuidadorId: number): Servicio {
  const now = new Date();
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return { id: 0, abuelo_id: 0, cuidador_id: cuidadorId, nota: '', inicio: now.toISOString(), fin: end.toISOString(), tarifa_hora: 0, total: 0, comision: 0, estado: 'activo', estado_pago: 'pendiente' };
}

export function CaregiverWorkspaceScreen({ tab, user, onSelectTab, onSaveLocation, onUpdateUser, onSignOut }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('Todas');
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [draftMessage, setDraftMessage] = useState('');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [serviciosLoading, setServiciosLoading] = useState(false);
  const [servicioError, setServicioError] = useState('');
  const [servicioDraft, setServicioDraft] = useState<Servicio | null>(null);
  const [servicioSaving, setServicioSaving] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileConfirmation, setProfileConfirmation] = useState<ProfileConfirmation | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
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
    Alert.alert(
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
      Alert.alert('Documentos enviados', 'Tu verificación quedó en revisión. No podrás activarte hasta que sea aprobada.');
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
      const data = await getServicios(user.token);
      const mine = data
        .filter((r) => Number(r.cuidador_id) === user.id)
        .map((r) => ({
          id: Number(r.id),
          abuelo_id: Number(r.abuelo_id),
          cuidador_id: Number(r.cuidador_id),
          nota: String(r.nota ?? ''),
          inicio: String(r.inicio ?? ''),
          fin: String(r.fin ?? ''),
          tarifa_hora: Number(r.tarifa_hora ?? 0),
          total: Number(r.total ?? 0),
          comision: Number(r.comision ?? 0),
          estado: String(r.estado ?? 'activo'),
          estado_pago: String(r.estado_pago ?? 'pendiente'),
        } as Servicio));
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
  const saveServicio = async () => {
    if (!servicioDraft || !user.id) return;
    if (!servicioDraft.abuelo_id) { setServicioError('Indica el abuelo_id.'); return; }
    setServicioSaving(true);
    setServicioError('');
    try {
      const payload = toApiServicio({ ...servicioDraft, cuidador_id: user.id });
      if (servicioDraft.id) await updateServicio(servicioDraft.id, payload, user.token);
      else await createServicio(payload, user.token);
      setServicioDraft(null);
      await loadServicios();
    } catch (e) {
      setServicioError(e instanceof Error ? e.message : 'No se pudo guardar el servicio.');
    } finally {
      setServicioSaving(false);
    }
  };

  const removeServicio = async (id: number) => {
    setServicioError('');
    try { await deleteServicio(id, user.token); await loadServicios(); }
    catch (e) { setServicioError(e instanceof Error ? e.message : 'No se pudo eliminar el servicio.'); }
  };

  const openChat = (clientId: string) => {
    setSelectedClientId(clientId);
    onSelectTab('messages');
  };

  const sendMessage = () => {
    const text = draftMessage.trim();
    if (!text || !selectedClientId) return;
    setMessages((current) => ({
      ...current,
      [selectedClientId]: [...(current[selectedClientId] ?? []), text],
    }));
    setDraftMessage('');
  };

  const activeClient = clients.find((client) => client.id === selectedClientId);

  return (
    <View style={styles.screen}>
      {tab === 'notifications' && (
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
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
              <Text style={styles.summaryTitle}>Tienes novedades</Text>
              <Text style={styles.summarySubtitle}>Revisa lo que está pasando con tu perfil.</Text>
            </View>
            <View style={styles.countBadge}><Text style={styles.countText}>{notifications.length}</Text></View>
          </View>
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
          {notifications
            .filter((item) => selectedCategory === 'Todas' || item.category === selectedCategory)
            .map((item) => {
              const isRead = readNotifications.includes(item.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => {
                    setReadNotifications((current) => current.includes(item.id) ? current : [...current, item.id]);
                    if (item.target === 'messages' || item.target === 'clients') onSelectTab(item.target);
                  }}
                  style={[styles.notificationCard, !isRead && styles.unreadCard]}
                >
                  <View style={[styles.notificationIcon, item.category === 'Opiniones' && styles.reviewIcon]}>
                    <Text style={[styles.notificationIconText, item.category === 'Opiniones' && styles.reviewIconText]}>
                      {item.icon}
                    </Text>
                  </View>
                  <View style={styles.notificationCopy}>
                    <View style={styles.notificationTitleLine}>
                      <Text style={styles.notificationTitle}>{item.title}</Text>
                      {!isRead && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationBody}>{item.body}</Text>
                    <Text style={styles.notificationMeta}>{item.category} · {item.time}</Text>
                  </View>
                </Pressable>
              );
            })}
          <Text style={styles.demoNote}>Avisos de ejemplo · no están conectados a un servicio.</Text>
        </ScrollView>
      )}

      {tab === 'messages' && (
        activeClient ? (
          <View style={styles.chatScreen}>
            <View style={styles.chatHeader}>
              <Pressable accessibilityLabel="Volver a mensajes" onPress={() => setSelectedClientId(null)} style={styles.chatBack}>
                <Text style={styles.chatBackText}>‹</Text>
              </Pressable>
              <Avatar initials={activeClient.initials} color={activeClient.color} size={38} />
              <View style={styles.chatHeaderCopy}>
                <Text style={styles.chatName}>{activeClient.name}</Text>
                <Text style={styles.chatStatus}>Contacto de cliente · demostración</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.chatDate}>HOY</Text>
              {(messages[activeClient.id] ?? []).map((message, index) => {
                const isOwnMessage = index >= (initialMessages[activeClient.id]?.length ?? 0) || index % 2 === 1;
                return (
                  <View key={`${activeClient.id}-${index}`} style={[styles.messageBubble, isOwnMessage && styles.ownMessage]}>
                    <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>{message}</Text>
                  </View>
                );
              })}
              <Text style={styles.demoNote}>Conversación de muestra · no se envían mensajes.</Text>
            </ScrollView>
            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="Escribe un mensaje"
                onChangeText={setDraftMessage}
                onSubmitEditing={sendMessage}
                placeholder="Escribe un mensaje..."
                placeholderTextColor="#91A0A3"
                returnKeyType="send"
                style={styles.composerInput}
                value={draftMessage}
              />
              <Pressable accessibilityLabel="Enviar mensaje de demostración" onPress={sendMessage} style={styles.sendButton}>
                <Text style={styles.sendButtonText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            <Text style={styles.pageTitle}>Mensajes</Text>
            <Text style={styles.subtitle}>Conversaciones directas con las familias.</Text>
            {clients.map((client) => (
              <Pressable key={client.id} onPress={() => setSelectedClientId(client.id)} style={styles.conversationCard}>
                <Avatar initials={client.initials} color={client.color} size={49} />
                <View style={styles.conversationCopy}>
                  <View style={styles.conversationTitleLine}>
                    <Text style={styles.conversationName}>{client.name}</Text>
                    <Text style={styles.conversationTime}>10:42</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.conversationPreview}>{client.preview}</Text>
                  <Text style={styles.conversationPlace}>{client.location}</Text>
                </View>
              </Pressable>
            ))}
            <Text style={styles.demoNote}>Mensajes de demostración · no están conectados a un servicio.</Text>
          </ScrollView>
        )
      )}

      {tab === 'clients' && (
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>Servicios</Text>
          <Text style={styles.subtitle}>Gestiona los servicios que ofreces como cuidador.</Text>
          <Pressable accessibilityRole="button" onPress={() => setServicioDraft(emptyServicio(user.id ?? 0))} style={styles.saveLocationButton}>
            <Text style={styles.saveLocationText}>Agregar servicio</Text>
          </Pressable>
          {serviciosLoading ? <ActivityIndicator color={colors.tealDark} style={{ marginTop: 12 }} /> : null}
          {servicioError ? <Text style={styles.locationError}>{servicioError}</Text> : null}
          {servicios.map((s) => (
            <View key={s.id} style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>{s.nota || `Servicio #${s.id}`}</Text>
              <Text style={styles.detailText}>Abuelo: {s.abuelo_id} · {s.estado} · Pago: {s.estado_pago}</Text>
              <Text style={styles.profileDescription}>{s.inicio} - {s.fin}</Text>
              <Text style={styles.profileDescription}>${s.tarifa_hora}/h · Total ${s.total} · Comisión ${s.comision}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable onPress={() => setServicioDraft({ ...s })} style={styles.messageAction}><Text style={styles.messageActionText}>Editar</Text></Pressable>
                <Pressable onPress={() => void removeServicio(s.id)} style={styles.messageAction}><Text style={styles.messageActionText}>Eliminar</Text></Pressable>
              </View>
            </View>
          ))}
          {!serviciosLoading && !servicios.length ? <Text style={styles.demoNote}>No tienes servicios registrados.</Text> : null}

          <Modal visible={!!servicioDraft} animationType="slide" transparent onRequestClose={() => setServicioDraft(null)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                  <Text style={styles.pageTitle}>{servicioDraft?.id ? 'Editar servicio' : 'Nuevo servicio'}</Text>
                  <TextInput style={styles.locationInput} placeholder="Abuelo ID" keyboardType="numeric" value={servicioDraft?.abuelo_id ? String(servicioDraft.abuelo_id) : ''} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, abuelo_id: Number(v.replace(/\D/g, '') || 0) } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Nota" value={servicioDraft?.nota ?? ''} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, nota: v } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Inicio ISO (2026-01-15T08:00:00Z)" value={servicioDraft?.inicio ?? ''} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, inicio: v } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Fin ISO (2026-01-15T10:00:00Z)" value={servicioDraft?.fin ?? ''} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, fin: v } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Tarifa hora" keyboardType="numeric" value={String(servicioDraft?.tarifa_hora ?? '')} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, tarifa_hora: Number(v.replace(/[^\d.]/g, '') || 0) } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Total" keyboardType="numeric" value={String(servicioDraft?.total ?? '')} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, total: Number(v.replace(/[^\d.]/g, '') || 0) } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Comisión" keyboardType="numeric" value={String(servicioDraft?.comision ?? '')} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, comision: Number(v.replace(/[^\d.]/g, '') || 0) } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Estado (activo/completado/cancelado)" value={servicioDraft?.estado ?? ''} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, estado: v } : d)} />
                  <TextInput style={[styles.locationInput, { marginTop: 8 }]} placeholder="Estado pago (pendiente/pagado)" value={servicioDraft?.estado_pago ?? ''} onChangeText={(v) => setServicioDraft((d) => d ? { ...d, estado_pago: v } : d)} />
                  {servicioError ? <Text style={styles.locationError}>{servicioError}</Text> : null}
                  <Pressable disabled={servicioSaving} onPress={() => void saveServicio()} style={styles.saveLocationButton}><Text style={styles.saveLocationText}>{servicioSaving ? 'Guardando...' : 'Guardar'}</Text></Pressable>
                  <Pressable onPress={() => setServicioDraft(null)} style={styles.signOutButton}><Text style={styles.signOutText}>Cancelar</Text></Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}

      {tab === 'profile' && user.caregiverProfile && (
        <ScrollView contentContainerStyle={styles.profilePage} showsVerticalScrollIndicator={false}>
          <View style={styles.profileHero}>
            <View style={styles.profileTopLine}>
              <Text style={styles.profilePageTitle}>Perfil</Text>
              <View style={[styles.profileCheckBadge, user.caregiverProfile.verificado && styles.profileCheckBadgeVerified]}>
                <Text style={[styles.profileCheckText, user.caregiverProfile.verificado && styles.profileCheckTextVerified]}>
                  {user.caregiverProfile.verificado ? '✓' : '!'}
                </Text>
              </View>
            </View>
            <View style={styles.profilePortrait}>
              <View style={styles.profilePortraitRing}>
                {user.profilePhotoUri ? (
                  <Image source={{ uri: user.profilePhotoUri }} style={styles.profilePortraitImage} />
                ) : (
                  <Text style={styles.profilePortraitInitial}>{user.name.charAt(0).toUpperCase()}</Text>
                )}
              </View>
            </View>
            <View style={styles.profileSummaryCard}>
              <View style={styles.profileNameLine}>
                <View style={styles.profileNameCopy}>
                  <Text style={styles.profileDisplayName}>{user.name}</Text>
                  <Text style={styles.profileDisplaySubtitle}>{user.caregiverProfile.professionalTitle || 'Cuidador profesional'}</Text>
                </View>
                <View style={[styles.profileRoleBadge, user.caregiverProfile.verificado && styles.profileRoleBadgeVerified]}>
                  <Text style={[styles.profileRoleBadgeText, user.caregiverProfile.verificado && styles.profileRoleBadgeTextVerified]}>
                    {user.caregiverProfile.verificado ? 'Verificado' : 'Cuidador'}
                  </Text>
                </View>
              </View>
              <View style={styles.profileStats}>
                <ProfileStat value={`${user.caregiverProfile.yearsExperience}`} label="Años exp." />
                <View style={styles.profileStatDivider} />
                <ProfileStat value={`$${user.caregiverProfile.hourlyRate}`} label="MXN / hora" />
                <View style={styles.profileStatDivider} />
                <ProfileStat value={`${user.caregiverProfile.specialties.length}`} label="Especialidades" />
              </View>
              <View style={styles.profileAvailability}>
                <View style={[styles.profileAvailabilityDot, profileDraft.disponible && user.caregiverProfile.verificado && styles.profileAvailabilityDotOn]} />
                <View style={styles.profileAvailabilityCopy}>
                  <Text style={styles.profileAvailabilityTitle}>
                    {profileDraft.disponible && user.caregiverProfile.verificado ? 'Disponible para recibir servicios' : 'No disponible'}
                  </Text>
                  <Text style={styles.profileAvailabilityHint}>
                    {user.caregiverProfile.verificado ? 'Controla si las familias pueden encontrarte' : 'Completa tu verificación para activarte'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: profileDraft.disponible && !!user.caregiverProfile.verificado }}
                  onPress={() => {
                    if (!user.caregiverProfile?.verificado) {
                      Alert.alert(
                        'Verificación requerida',
                        'No puedes estar activo si tu cuenta no está verificada. Sube tu INE y selfie en esta misma pantalla.',
                      );
                      return;
                    }
                    const next = !profileDraft.disponible;
                    setProfileDraft((d) => ({ ...d, disponible: next }));
                    onUpdateUser({ ...user, caregiverProfile: { ...user.caregiverProfile!, disponible: next } });
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
          </View>

          {!user.caregiverProfile.verificado && (
            <View style={[styles.detailsCard, styles.profileSectionCard]}>
            <View style={styles.profileSectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>Verificación</Text>
                <Text style={styles.profileSectionHint}>Identidad segura para las familias</Text>
              </View>
              <View style={styles.verificationStateBadge}>
                <Text style={styles.verificationStateText}>Pendiente</Text>
              </View>
            </View>
            <Text style={styles.profileDescription}>
              Sube una foto clara de tu INE y un selfie para que un administrador revise tu cuenta. Mientras tanto no puedes estar activo.
            </Text>
            <View style={styles.verificationRow}>
              <Pressable onPress={() => askVerificationImage('ine')} style={styles.verificationPick}>
                {ineUri ? <Image source={{ uri: ineUri }} style={styles.verificationPreview} /> : <Text style={styles.verificationPickText}>Seleccionar INE</Text>}
              </Pressable>
              <Pressable onPress={() => askVerificationImage('selfie')} style={styles.verificationPick}>
                {selfieUri ? <Image source={{ uri: selfieUri }} style={styles.verificationPreview} /> : <Text style={styles.verificationPickText}>Seleccionar selfie</Text>}
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
            <Text style={styles.sectionTitle}>Tu cuenta</Text>
            <Pressable accessibilityRole="button" onPress={startEditingProfile} style={styles.profileMenuRow}>
              <View style={styles.profileMenuIcon}><Text style={styles.profileMenuIconText}>◉</Text></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuTitle}>Información personal</Text>
                <Text style={styles.profileMenuSubtitle}>{user.email} · {user.phone || 'Agrega tu teléfono'}</Text>
              </View>
              <Text style={styles.profileMenuArrow}>›</Text>
            </Pressable>
          </View>

          <Modal visible={profileEditing} animationType="fade" transparent onRequestClose={() => setProfileConfirmation('discardProfile')}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                  <Text style={styles.pageTitle}>Editar información</Text>
                  <Text style={styles.subtitle}>Actualiza los datos que ven las familias en tu perfil.</Text>
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
          </Modal>

          <LocationEditor coordinates={user.caregiverProfile.serviceCoordinates} location={user.caregiverProfile.serviceLocation} onSave={onSaveLocation} />

          <View style={styles.accountActions}>
            <Pressable disabled={profileSaving} onPress={() => setProfileConfirmation('removeProfile')} style={styles.accountActionRow}>
              <Text style={styles.accountActionTextDanger}>{profileSaving ? 'Eliminando perfil...' : 'Eliminar perfil de cuidador'}</Text>
              <Text style={styles.profileMenuArrow}>›</Text>
            </Pressable>
            <Pressable disabled={profileSaving} onPress={() => setProfileConfirmation('deleteAccount')} style={styles.accountActionRow}>
              <Text style={styles.accountActionTextDanger}>{profileSaving ? 'Eliminando cuenta...' : 'Eliminar cuenta'}</Text>
              <Text style={styles.profileMenuArrow}>›</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.accountActionRow}>
              <Text style={styles.accountActionText}>Cerrar sesión</Text>
              <Text style={styles.profileMenuArrow}>›</Text>
            </Pressable>
          </View>
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
            placeholderTextColor="#91A0A3"
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

function Avatar({ initials, color, size }: { initials: string; color: string; size: number }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color, height: size, width: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(13, size * 0.25) }]}>{initials}</Text>
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

function initialsFor(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  page: { paddingHorizontal: 19, paddingTop: 24, paddingBottom: 30 },
  profilePage: { backgroundColor: '#F0F1F7', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30 },
  pageTitle: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  profileHero: { backgroundColor: '#ECEEF6', borderRadius: 25, marginHorizontal: -16, marginTop: -12, paddingHorizontal: 16, paddingTop: 13 },
  profileTopLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profilePageTitle: { color: '#20212B', fontSize: 25, fontWeight: '800' },
  profileCheckBadge: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 22, height: 42, justifyContent: 'center', width: 42 },
  profileCheckBadgeVerified: { backgroundColor: '#E1F3EA' },
  profileCheckText: { color: '#9B6D25', fontSize: 18, fontWeight: '800' },
  profileCheckTextVerified: { color: colors.green },
  profilePortrait: { alignItems: 'center', marginTop: 8, zIndex: 1 },
  profilePortraitRing: { alignItems: 'center', backgroundColor: colors.white, borderColor: '#CDE7E8', borderRadius: 54, borderWidth: 4, height: 108, justifyContent: 'center', overflow: 'hidden', width: 108 },
  profilePortraitImage: { height: 100, width: 100 },
  profilePortraitInitial: { color: colors.tealDark, fontSize: 40, fontWeight: '800' },
  profileSummaryCard: { backgroundColor: colors.white, borderColor: '#E8E8EF', borderRadius: 24, borderWidth: 1, marginBottom: 17, marginTop: -38, paddingHorizontal: 17, paddingTop: 51, paddingBottom: 16, shadowColor: '#24283D', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 3 },
  profileNameLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profileNameCopy: { flex: 1, paddingRight: 8 },
  profileDisplayName: { color: '#252631', fontSize: 17, fontWeight: '800' },
  profileDisplaySubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  profileRoleBadge: { backgroundColor: '#292A34', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7 },
  profileRoleBadgeVerified: { backgroundColor: '#E1F3EA' },
  profileRoleBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  profileRoleBadgeTextVerified: { color: colors.green },
  profileStats: { alignItems: 'center', backgroundColor: '#F7F7FA', borderRadius: 17, flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingVertical: 12 },
  profileStat: { alignItems: 'center', flex: 1 },
  profileStatValue: { color: '#292A34', fontSize: 17, fontWeight: '800' },
  profileStatLabel: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: 'center' },
  profileStatDivider: { backgroundColor: '#E3E4EA', height: 30, width: 1 },
  profileAvailability: { alignItems: 'center', backgroundColor: '#F1F5F3', borderRadius: 15, flexDirection: 'row', marginTop: 13, paddingHorizontal: 12, paddingVertical: 10 },
  profileAvailabilityDot: { backgroundColor: colors.gold, borderRadius: 5, height: 10, width: 10 },
  profileAvailabilityDotOn: { backgroundColor: colors.green },
  profileAvailabilityCopy: { flex: 1, marginLeft: 9 },
  profileAvailabilityTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  profileAvailabilityHint: { color: colors.muted, fontSize: 9, marginTop: 3 },
  summaryCard: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 16, flexDirection: 'row', marginTop: 19, padding: 14 },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  summaryIconText: { color: colors.tealDark, fontSize: 23 },
  summaryCopy: { flex: 1, marginLeft: 11 },
  summaryTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  summarySubtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
  countBadge: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 13, height: 26, justifyContent: 'center', width: 26 },
  countText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  categoryScroller: { flexGrow: 0, marginBottom: 22, marginTop: 17 },
  categoryChip: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 17, borderWidth: 1, marginRight: 7, paddingHorizontal: 12, paddingVertical: 8 },
  selectedCategoryChip: { backgroundColor: colors.ink, borderColor: colors.ink },
  categoryText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  selectedCategoryText: { color: colors.white },
  sectionEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 9 },
  notificationCard: { alignItems: 'flex-start', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginBottom: 9, padding: 13 },
  unreadCard: { borderColor: '#B9E0E2' },
  notificationIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  notificationIconText: { color: colors.tealDark, fontSize: 18, fontWeight: '800' },
  reviewIcon: { backgroundColor: '#FFF5DB' },
  reviewIconText: { color: '#C99422' },
  notificationCopy: { flex: 1, marginLeft: 10 },
  notificationTitleLine: { alignItems: 'center', flexDirection: 'row' },
  notificationTitle: { color: colors.ink, flex: 1, fontSize: 11, fontWeight: '800' },
  unreadDot: { backgroundColor: colors.tealDark, borderRadius: 4, height: 7, marginLeft: 5, width: 7 },
  notificationBody: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  notificationMeta: { color: colors.tealDark, fontSize: 9, fontWeight: '600', marginTop: 7 },
  demoNote: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 13, textAlign: 'center' },
  conversationCard: { alignItems: 'center', backgroundColor: colors.white, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 14 },
  conversationCopy: { flex: 1, marginLeft: 11 },
  conversationTitleLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  conversationName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  conversationTime: { color: colors.muted, fontSize: 9 },
  conversationPreview: { color: colors.muted, fontSize: 10, marginTop: 5 },
  conversationPlace: { color: colors.tealDark, fontSize: 9, marginTop: 4 },
  chatScreen: { backgroundColor: colors.canvas, flex: 1 },
  chatHeader: { alignItems: 'center', backgroundColor: colors.white, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  chatBack: { alignItems: 'center', height: 38, justifyContent: 'center', marginRight: 7, width: 29 },
  chatBackText: { color: colors.ink, fontSize: 30, lineHeight: 34, marginTop: -4 },
  chatHeaderCopy: { flex: 1, marginLeft: 9 },
  chatName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  chatStatus: { color: colors.muted, fontSize: 9, marginTop: 3 },
  chatContent: { alignItems: 'flex-start', flexGrow: 1, paddingHorizontal: 16, paddingVertical: 18 },
  chatDate: { alignSelf: 'center', color: colors.muted, fontSize: 9, fontWeight: '700', marginBottom: 18 },
  messageBubble: { backgroundColor: colors.white, borderRadius: 15, borderBottomLeftRadius: 4, marginBottom: 10, maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 10 },
  ownMessage: { alignSelf: 'flex-end', backgroundColor: colors.tealDark, borderBottomLeftRadius: 15, borderBottomRightRadius: 4 },
  messageText: { color: colors.ink, fontSize: 11, lineHeight: 16 },
  ownMessageText: { color: colors.white },
  composer: { alignItems: 'center', backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 9 },
  composerInput: { backgroundColor: colors.canvas, borderRadius: 20, color: colors.ink, flex: 1, fontSize: 11, height: 40, paddingHorizontal: 14 },
  sendButton: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 20, height: 38, justifyContent: 'center', marginLeft: 8, width: 38 },
  sendButtonText: { color: colors.white, fontSize: 19, fontWeight: '700' },
  contactSummary: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.tealPale, borderRadius: 13, flexDirection: 'row', marginVertical: 18, paddingHorizontal: 13, paddingVertical: 9 },
  contactSummaryNumber: { color: colors.tealDark, fontSize: 15, fontWeight: '800' },
  contactSummaryText: { color: colors.tealDark, fontSize: 10, marginLeft: 7 },
  clientCard: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginBottom: 10, padding: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.tealDark, fontWeight: '800' },
  clientCopy: { flex: 1, marginLeft: 10 },
  clientName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  clientRelationship: { color: colors.muted, fontSize: 9, marginTop: 4 },
  clientLocation: { color: colors.tealDark, fontSize: 9, marginTop: 5 },
  messageAction: { backgroundColor: colors.tealPale, borderRadius: 15, marginLeft: 7, paddingHorizontal: 10, paddingVertical: 8 },
  messageActionText: { color: colors.tealDark, fontSize: 9, fontWeight: '800' },
  locationCard: { backgroundColor: colors.white, borderColor: '#E8E8EF', borderRadius: 21, borderWidth: 1, marginTop: 13, padding: 17 },
  locationHeading: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  locationIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 18, height: 36, justifyContent: 'center', marginRight: 9, width: 36 },
  pinOuter: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 8, height: 16, justifyContent: 'center', width: 16 },
  pinInner: { backgroundColor: colors.white, borderRadius: 3, height: 6, width: 6 },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  locationHint: { color: colors.muted, fontSize: 9, marginTop: 3 },
  locationInput: { backgroundColor: colors.canvas, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 11, height: 43, paddingHorizontal: 11 },
  useLocationButton: { alignSelf: 'flex-start', backgroundColor: colors.tealPale, borderRadius: 10, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8 },
  useLocationText: { color: colors.tealDark, fontSize: 9, fontWeight: '700' },
  mapPreview: { borderRadius: 12, height: 190, marginTop: 10, overflow: 'hidden' },
  coordinatesNote: { color: colors.muted, fontSize: 9, marginTop: 7 },
  locationError: { color: '#C74C45', fontSize: 10, marginTop: 6 },
  saveLocationButton: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 10, marginTop: 9, paddingVertical: 10 },
  saveLocationText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  detailsCard: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 14 },
  profileSectionCard: { borderColor: '#E8E8EF', borderRadius: 21, marginTop: 13, padding: 17, shadowColor: '#24283D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.035, shadowRadius: 10, elevation: 1 },
  profileSectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profileSectionHint: { color: colors.muted, fontSize: 9, marginTop: 3 },
  verificationStateBadge: { backgroundColor: '#FFF5DF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  verificationStateText: { color: '#98702D', fontSize: 9, fontWeight: '800' },
  profileMenuRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12, paddingVertical: 5 },
  profileMenuIcon: { alignItems: 'center', backgroundColor: '#F1F1F6', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  profileMenuIconText: { color: colors.tealDark, fontSize: 18, fontWeight: '700' },
  profileMenuCopy: { flex: 1, marginLeft: 11 },
  profileMenuTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  profileMenuSubtitle: { color: colors.muted, fontSize: 9, marginTop: 4 },
  profileMenuArrow: { color: '#7C818D', fontSize: 24, marginLeft: 8 },
  accountActions: { backgroundColor: colors.white, borderColor: '#E8E8EF', borderRadius: 20, borderWidth: 1, marginTop: 13, paddingHorizontal: 15 },
  accountActionRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  accountActionText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  accountActionTextDanger: { color: '#B64B47', fontSize: 10, fontWeight: '700' },
  detailText: { color: colors.tealDark, fontSize: 10, fontWeight: '700', marginTop: 7 },
  profileDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  specialtyChip: { backgroundColor: colors.tealPale, borderRadius: 11, color: colors.tealDark, fontSize: 9, marginBottom: 5, marginRight: 5, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 6 },
  signOutButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 12, borderWidth: 1, marginTop: 14, paddingVertical: 12 },
  signOutText: { color: colors.tealDark, fontSize: 11, fontWeight: '700' },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(17,39,41,0.5)', flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 24 },
  modalCard: { backgroundColor: colors.canvas, borderRadius: 24, maxHeight: '90%', maxWidth: 520, width: '100%' },
  modalContent: { padding: 20, paddingBottom: 24 },
  switchTrack: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#C7D4D6', padding: 2 },
  switchTrackOn: { backgroundColor: colors.tealDark },
  switchTrackDisabled: { opacity: 0.45 },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white },
  switchThumbOn: { marginLeft: 20 },
  verificationBanner: { backgroundColor: '#FFF6E2', borderColor: colors.gold, borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 13 },
  verificationBannerTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  verificationBannerText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  verificationBannerAction: { color: colors.tealDark, fontSize: 10, fontWeight: '800', marginTop: 8 },
  verificationReviewText: { color: colors.tealDark, fontSize: 10, fontWeight: '700', marginTop: 9 },
  verificationRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  verificationPick: { alignItems: 'center', backgroundColor: colors.canvas, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flex: 1, height: 96, justifyContent: 'center', overflow: 'hidden' },
  verificationPickText: { color: colors.tealDark, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  verificationPreview: { height: 96, width: '100%' },
});
