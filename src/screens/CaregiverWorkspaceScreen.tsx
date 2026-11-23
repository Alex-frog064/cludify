import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CaregiverTabKey, TabKey } from '../components/BottomTabBar';
import { colors } from '../theme';
import { getCurrentServiceLocation } from '../utils/currentServiceLocation';
import { Coordinates, UserAccount } from '../types';

type Props = {
  tab: CaregiverTabKey;
  user: UserAccount;
  onSelectTab: (tab: TabKey) => void;
  onSaveLocation: (location: string, coordinates?: Coordinates) => void;
  onSignOut: () => void;
};

type NotificationCategory = 'Todas' | 'Solicitudes' | 'Opiniones' | 'Ofertas' | 'Mensajes';

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
    icon: '★',
    title: 'Recibiste una nueva opinión',
    body: '“María fue muy atenta y puntual. La recomendamos.”',
    time: 'Hace 2 h',
    target: 'profile',
  },
  {
    id: 'offer',
    category: 'Ofertas',
    icon: '✦',
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

export function CaregiverWorkspaceScreen({ tab, user, onSelectTab, onSaveLocation, onSignOut }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('Todas');
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [draftMessage, setDraftMessage] = useState('');

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
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>♧</Text></View>
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
                <Text style={styles.sendButtonText}>↑</Text>
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
          <Text style={styles.pageTitle}>Clientes</Text>
          <Text style={styles.subtitle}>Familias que te contactaron o con las que has colaborado.</Text>
          <View style={styles.contactSummary}>
            <Text style={styles.contactSummaryNumber}>{clients.length}</Text>
            <Text style={styles.contactSummaryText}>contactos de ejemplo</Text>
          </View>
          {clients.map((client) => (
            <View key={client.id} style={styles.clientCard}>
              <Avatar initials={client.initials} color={client.color} size={51} />
              <View style={styles.clientCopy}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.clientRelationship}>{client.relationship}</Text>
                <Text style={styles.clientLocation}>⌖  {client.location}</Text>
              </View>
              <Pressable accessibilityLabel={`Escribir a ${client.name}`} onPress={() => openChat(client.id)} style={styles.messageAction}>
                <Text style={styles.messageActionText}>Mensaje</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.demoNote}>Contactos de ejemplo · no corresponden a clientes reales.</Text>
        </ScrollView>
      )}

      {tab === 'profile' && user.caregiverProfile && (
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>Mi perfil</Text>
          <Text style={styles.subtitle}>Así te verán las familias cuando exploren cuidadores.</Text>
          <View style={styles.profileCard}>
            {user.profilePhotoUri ? (
              <Image source={{ uri: user.profilePhotoUri }} style={styles.profilePhoto} />
            ) : (
              <Avatar initials={initialsFor(user.name)} color={colors.tealPale} size={76} />
            )}
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileTitle}>{user.caregiverProfile.professionalTitle}</Text>
            <View style={styles.profileRoleBadge}>
              <Text style={styles.profileRoleText}>Perfil de cuidador · demostración</Text>
            </View>
          </View>

          <LocationEditor
            coordinates={user.caregiverProfile.serviceCoordinates}
            location={user.caregiverProfile.serviceLocation}
            onSave={onSaveLocation}
          />

          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Tu experiencia</Text>
            <Text style={styles.detailText}>
              {user.caregiverProfile.yearsExperience} años · ${user.caregiverProfile.hourlyRate} MXN por hora
            </Text>
            <Text style={styles.profileDescription}>{user.caregiverProfile.description}</Text>
            <View style={styles.specialties}>
              {user.caregiverProfile.specialties.map((specialty) => (
                <Text key={specialty} style={styles.specialtyChip}>{specialty}</Text>
              ))}
            </View>
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Disponibilidad</Text>
            <Text style={styles.detailText}>{user.caregiverProfile.availability.days.join(', ')}</Text>
            <Text style={styles.profileDescription}>
              {user.caregiverProfile.availability.startTime}–{user.caregiverProfile.availability.endTime}
            </Text>
          </View>

          <Pressable onPress={onSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </Pressable>
          <Text style={styles.demoNote}>Tu perfil se mantiene solo mientras la app está abierta.</Text>
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

  const useCurrentLocation = async () => {
    setIsLocating(true);
    setError('');
    try {
      const result = await getCurrentServiceLocation();
      if (!result.granted) {
        setError('Permite el acceso a tu ubicación o escribe tu zona manualmente.');
        return;
      }
      setValue(result.label);
      setCoordinates(result.coordinates);
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? `No se pudo obtener la ubicación: ${locationError.message}`
          : 'No se pudo obtener la ubicación. Escribe tu zona manualmente.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  const save = () => {
    const nextLocation = value.trim();
    if (!nextLocation) {
      setError('Escribe una colonia, zona o ciudad.');
      return;
    }
    setError('');
    onSave(nextLocation, coordinates);
  };

  return (
    <View style={styles.locationCard}>
      <View style={styles.locationHeading}>
        <View style={styles.locationIcon}><Text style={styles.locationIconText}>⌖</Text></View>
        <View>
          <Text style={styles.sectionTitle}>Zona de servicio</Text>
          <Text style={styles.locationHint}>Las familias verán esta ubicación aproximada.</Text>
        </View>
      </View>
      <TextInput
        accessibilityLabel="Ubicación del cuidador"
        onChangeText={(text) => {
          setValue(text);
          setCoordinates(undefined);
          setError('');
        }}
        placeholder="Colonia, alcaldía o ciudad"
        placeholderTextColor="#91A0A3"
        style={styles.locationInput}
        value={value}
      />
      <Pressable disabled={isLocating} onPress={useCurrentLocation} style={styles.useLocationButton}>
        <Text style={styles.useLocationText}>
          {isLocating ? 'Buscando ubicación…' : '⌖  Usar ubicación actual'}
        </Text>
      </Pressable>
      {!!coordinates && (
        <Text style={styles.coordinatesNote}>
          Coordenadas guardadas: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
        </Text>
      )}
      {!!error && <Text accessibilityRole="alert" style={styles.locationError}>{error}</Text>}
      <Pressable onPress={save} style={styles.saveLocationButton}>
        <Text style={styles.saveLocationText}>Guardar ubicación</Text>
      </Pressable>
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
  pageTitle: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
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
  profileCard: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 18, marginTop: 19, padding: 20 },
  profilePhoto: { backgroundColor: colors.white, borderRadius: 38, height: 76, width: 76 },
  profileName: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 10 },
  profileTitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  profileRoleBadge: { backgroundColor: colors.white, borderRadius: 12, marginTop: 9, paddingHorizontal: 10, paddingVertical: 5 },
  profileRoleText: { color: colors.tealDark, fontSize: 9, fontWeight: '700' },
  locationCard: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 13, padding: 14 },
  locationHeading: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  locationIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 18, height: 36, justifyContent: 'center', marginRight: 9, width: 36 },
  locationIconText: { color: colors.tealDark, fontSize: 19 },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  locationHint: { color: colors.muted, fontSize: 9, marginTop: 3 },
  locationInput: { backgroundColor: colors.canvas, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 11, height: 43, paddingHorizontal: 11 },
  useLocationButton: { alignSelf: 'flex-start', backgroundColor: colors.tealPale, borderRadius: 10, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8 },
  useLocationText: { color: colors.tealDark, fontSize: 9, fontWeight: '700' },
  coordinatesNote: { color: colors.muted, fontSize: 9, marginTop: 7 },
  locationError: { color: '#C74C45', fontSize: 10, marginTop: 6 },
  saveLocationButton: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 10, marginTop: 9, paddingVertical: 10 },
  saveLocationText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  detailsCard: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 14 },
  detailText: { color: colors.tealDark, fontSize: 10, fontWeight: '700', marginTop: 7 },
  profileDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  specialtyChip: { backgroundColor: colors.tealPale, borderRadius: 11, color: colors.tealDark, fontSize: 9, marginBottom: 5, marginRight: 5, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 6 },
  signOutButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 12, borderWidth: 1, marginTop: 14, paddingVertical: 12 },
  signOutText: { color: colors.tealDark, fontSize: 11, fontWeight: '700' },
});
