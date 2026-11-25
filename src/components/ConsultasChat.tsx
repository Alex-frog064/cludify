import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';

import {
  enviarMensajeConsulta,
  getConsulta,
  getConsultas,
  getMensajesConsulta,
  marcarMensajesLeidos,
} from '../api/auth';
import { secondaryColors as colors } from '../theme';
import type { ConsultaCuidador, MensajeConsulta } from '../types';

type Props = {
  token?: string;
  currentUserId?: number;
  viewerRole: 'family' | 'caregiver';
  activeConsultaId?: number | null;
  onActiveConsultaChange?: (id: number | null) => void;
  onExplore?: () => void;
  onOpenClient?: (familiarId: number, familiarNombre: string, consultaId: number) => void;
  unansweredCount?: number;
  unansweredConsultaIds?: number[];
  unansweredByConsulta?: Record<number, number>;
  onMessagesChanged?: () => void;
};

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function conversationTitle(consulta: ConsultaCuidador, viewerRole: Props['viewerRole']) {
  return viewerRole === 'family'
    ? consulta.cuidador?.nombre ?? 'Cuidador'
    : consulta.familiar?.nombre ?? 'Familiar';
}

function conversationSubtitle(consulta: ConsultaCuidador, viewerRole: Props['viewerRole']) {
  return viewerRole === 'family'
    ? consulta.cuidador?.titulo ?? 'Cuidador'
    : 'Conversación con una familia';
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function formatConversationTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatTime(value);
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function mergeConsulta(current: ConsultaCuidador[], updated: ConsultaCuidador) {
  const index = current.findIndex((item) => item.consulta_id === updated.consulta_id);
  if (index === -1) return current;
  const existing = current[index];
  if (
    existing.no_leidos === updated.no_leidos
    && existing.actualizado_en === updated.actualizado_en
    && existing.creado_en === updated.creado_en
  ) return current;
  const next = [...current];
  next[index] = { ...existing, ...updated };
  return next;
}

export function ConsultasChat({
  token,
  currentUserId,
  viewerRole,
  activeConsultaId,
  onActiveConsultaChange,
  onExplore,
  onOpenClient,
  unansweredCount = 0,
  unansweredConsultaIds = [],
  unansweredByConsulta,
  onMessagesChanged,
}: Props) {
  const isFamily = viewerRole === 'family';
  const [consultas, setConsultas] = useState<ConsultaCuidador[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mensajes, setMensajes] = useState<MensajeConsulta[]>([]);
  const [messagesReadyFor, setMessagesReadyFor] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [consultasLoaded, setConsultasLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const data = await getConsultas(token);
        if (!active) return;
        setConsultas(data);
        setConsultasLoaded(true);
        setError('');
        if (activeConsultaId && data.some((item) => item.consulta_id === activeConsultaId)) {
          onActiveConsultaChange?.(null);
        }
        setSelectedId((current) => {
          if (activeConsultaId && data.some((item) => item.consulta_id === activeConsultaId)) {
            return activeConsultaId;
          }
          if (current && data.some((item) => item.consulta_id === current)) return current;
          return null;
        });
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus conversaciones.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => { void load(); }, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token, activeConsultaId, onActiveConsultaChange]);

  useEffect(() => {
    if (!token || !selectedId || !consultasLoaded) return;
    let active = true;
    const load = async () => {
      try {
        const data = await getMensajesConsulta(selectedId, token);
        if (!active) return;
        setMensajes(data);
        setMessagesReadyFor(selectedId);
        setError('');
        await marcarMensajesLeidos(selectedId, token).catch(() => undefined);
        const status = await getConsulta(selectedId, token).catch(() => null);
        if (!active || !status) return;
        setConsultas((current) => mergeConsulta(current, status));
      } catch (e) {
        if (active) {
          setMessagesReadyFor(selectedId);
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los mensajes.');
        }
      }
    };
    void load();
    const interval = setInterval(() => { void load(); }, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedId, token, consultasLoaded]);

  useEffect(() => {
    if (mensajes.length) scrollRef.current?.scrollToEnd({ animated: false });
  }, [mensajes.length, selectedId]);

  const selectConsulta = (id: number) => {
    setSelectedId(id);
    setMensajes([]);
    setMessagesReadyFor(null);
    setDraft('');
    setError('');
    onActiveConsultaChange?.(null);
  };

  const send = async () => {
    const contenido = draft.trim();
    if (!contenido || !token || !selectedId) return;
    setSending(true);
    try {
      const message = await enviarMensajeConsulta(selectedId, contenido, token);
      setMensajes((current) => [...current, message]);
      setDraft('');
      setError('');
      onMessagesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  if (!token) {
    return (
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Mensajes</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>◌</Text>
          <Text style={styles.emptyTitle}>Inicia sesión para ver tus conversaciones</Text>
          <Text style={styles.emptyText}>
            Desde el perfil de un cuidador puedes iniciar una conversación y conservar el historial aquí.
          </Text>
          {onExplore && (
            <Pressable onPress={onExplore} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Explorar cuidadores</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    );
  }

  const selected = consultas.find((item) => item.consulta_id === selectedId);

  return (
    <View style={styles.screen}>
      {selected ? (
        <View style={styles.threadTopBar}>
          <Pressable
            accessibilityLabel="Volver a conversaciones"
            accessibilityRole="button"
            onPress={() => {
              setSelectedId(null);
              onActiveConsultaChange?.(null);
            }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>{initialsFor(conversationTitle(selected, viewerRole))}</Text>
          </View>
          <View style={styles.threadTopCopy}>
            <Text numberOfLines={1} style={styles.threadName}>{conversationTitle(selected, viewerRole)}</Text>
            <Text numberOfLines={1} style={styles.threadStatus}>{conversationSubtitle(selected, viewerRole)}</Text>
          </View>
          {!isFamily && !!selected.familiar && onOpenClient && (
            <Pressable
              accessibilityLabel="Ver perfil del cliente"
              accessibilityRole="button"
              onPress={() => onOpenClient(selected.familiar!.id, selected.familiar!.nombre, selected.consulta_id)}
              style={styles.profileButton}
            >
              <Text style={styles.profileButtonText}>Perfil</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Mensajes</Text>
          <Text style={styles.subtitle}>Tus conversaciones de cuidado, en un solo lugar.</Text>
        </View>
      )}

      {!isFamily && unansweredCount > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!selected && unansweredConsultaIds.length) selectConsulta(unansweredConsultaIds[0]);
          }}
          style={styles.pendingBanner}
        >
          <Text style={styles.pendingBannerTitle}>{unansweredCount} mensaje{unansweredCount === 1 ? '' : 's'} sin contestar</Text>
          <Text style={styles.pendingBannerText}>{unansweredConsultaIds.length} conversación{unansweredConsultaIds.length === 1 ? '' : 'es'} pendiente{unansweredConsultaIds.length === 1 ? '' : 's'}</Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.tealDark} />
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
        </View>
      ) : consultas.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}><Text style={styles.emptyIcon}>○</Text></View>
          <Text style={styles.emptyTitle}>Aún no tienes conversaciones</Text>
          <Text style={styles.emptyText}>
            {isFamily
              ? 'Abre el perfil de un cuidador y toca “Enviar mensaje” para iniciar una conversación.'
              : 'Cuando una familia te escriba, la conversación aparecerá aquí.'}
          </Text>
          {isFamily && onExplore && (
            <Pressable onPress={onExplore} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Explorar cuidadores</Text>
            </Pressable>
          )}
        </View>
      ) : !selected ? (
        <View style={styles.listContainer}>
          <View style={styles.listHeading}>
            <View>
              <Text style={styles.listTitle}>Conversaciones</Text>
              <Text style={styles.listSubtitle}>Selecciona una para ver el historial.</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{consultas.length}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.conversationList} showsVerticalScrollIndicator={false}>
            {consultas.map((consulta) => {
              const name = conversationTitle(consulta, viewerRole);
              const unreadCount = Number(consulta.no_leidos ?? 0);
              const pendingCount = unansweredByConsulta?.[consulta.consulta_id] ?? 0;
              const lastActivity = consulta.actualizado_en ?? consulta.creado_en;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={consulta.consulta_id}
                  onPress={() => selectConsulta(consulta.consulta_id)}
                  style={styles.conversationCard}
                >
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{initialsFor(name)}</Text>
                  </View>
                  <View style={styles.conversationCopy}>
                    <View style={styles.conversationTopLine}>
                      <Text numberOfLines={1} style={styles.conversationName}>{name}</Text>
                      <Text style={styles.conversationTime}>{formatConversationTime(lastActivity)}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.conversationSubtitle}>{conversationSubtitle(consulta, viewerRole)}</Text>
                    <View style={styles.conversationBottomLine}>
                      <Text numberOfLines={1} style={[styles.conversationPreview, pendingCount > 0 && styles.pendingPreview]}>
                        {pendingCount
                          ? `${pendingCount} mensaje${pendingCount === 1 ? '' : 's'} sin contestar`
                          : unreadCount
                            ? `${unreadCount} mensaje${unreadCount === 1 ? '' : 's'} sin leer`
                            : 'Toca para ver los mensajes'}
                      </Text>
                      {pendingCount > 0 ? (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
                        </View>
                      ) : !!unreadCount ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.conversationArrow}>›</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <>
          <View style={styles.threadDetails}>
            <Text style={styles.threadDetailsText}>
              {!isFamily && (unansweredByConsulta?.[selected.consulta_id] ?? 0) > 0
                ? `${unansweredByConsulta?.[selected.consulta_id]} mensaje${(unansweredByConsulta?.[selected.consulta_id] ?? 0) === 1 ? '' : 's'} sin contestar`
                : isFamily ? 'Conversación con tu cuidador' : 'Conversación con una familia'}
            </Text>
            {!!selected.actualizado_en && (
              <Text style={styles.threadMeta}>Último movimiento · {formatConversationTime(selected.actualizado_en)}</Text>
            )}
          </View>
          <ScrollView
            contentContainerStyle={styles.thread}
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            style={styles.threadScroll}
          >
            {messagesReadyFor !== selectedId ? (
              <View style={styles.messagesLoading}>
                <ActivityIndicator color={colors.tealDark} size="small" />
                <Text style={styles.messagesLoadingText}>Cargando mensajes...</Text>
              </View>
            ) : mensajes.length === 0 ? (
              <View style={styles.threadEmpty}>
                <Text style={styles.threadEmptyTitle}>Aún no hay mensajes</Text>
                <Text style={styles.threadEmptyText}>
                  {isFamily ? 'Escribe un mensaje para iniciar la conversación.' : 'Cuando la familia escriba, los mensajes aparecerán aquí.'}
                </Text>
              </View>
            ) : mensajes.map((message) => {
              const isOwn = currentUserId
                ? message.emisor_id === currentUserId
                : isFamily
                  ? message.emisor?.rol === 'familiar'
                  : message.emisor?.rol === 'cuidador';
              return (
                <View key={message.id} style={[styles.messageRow, isOwn && styles.ownMessageRow]}>
                  <View style={[styles.bubble, isOwn && styles.ownBubble]}>
                    {!isOwn && !!message.emisor?.nombre && (
                      <Text style={styles.senderName}>{message.emisor.nombre}</Text>
                    )}
                    <Text style={[styles.bubbleText, isOwn && styles.ownBubbleText]}>{message.contenido}</Text>
                    <Text style={[styles.bubbleTime, isOwn && styles.ownBubbleTime]}>
                      {formatTime(message.creado_en)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Escribe un mensaje"
              maxLength={2000}
              multiline
              onChangeText={setDraft}
              placeholder="Escribe tu mensaje..."
              placeholderTextColor={colors.line}
              style={styles.composerInput}
              value={draft}
            />
            <Pressable
              accessibilityLabel="Enviar mensaje"
              disabled={sending || !draft.trim()}
              onPress={send}
              style={[styles.sendButton, (!draft.trim() || sending) && styles.disabledButton]}
            >
              {sending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Enviar</Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  page: { paddingBottom: 36, paddingHorizontal: 18, paddingTop: 20 },
  pageTitle: { color: colors.tealDark, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 6 },
  loadingWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 12, marginTop: 10 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 22,
    marginHorizontal: 18,
    marginTop: 24,
    padding: 26,
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.tealPale,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyIcon: { color: colors.tealDark, fontSize: 34 },
  emptyTitle: { color: colors.tealDark, fontSize: 16, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.teal,
    borderRadius: 22,
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  listContainer: { flex: 1 },
  listHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listTitle: { color: colors.tealDark, fontSize: 16, fontWeight: '800' },
  listSubtitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.highlightSoft,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    minWidth: 32,
    paddingHorizontal: 8,
  },
  countBadgeText: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  pendingBanner: { backgroundColor: colors.highlightSoft, borderRadius: 18, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10 },
  pendingBannerTitle: { color: colors.tealDark, fontSize: 11, fontWeight: '800' },
  pendingBannerText: { color: colors.ink, fontSize: 9, marginTop: 3 },
  conversationList: { paddingHorizontal: 16, paddingBottom: 32 },
  conversationCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 84,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  contactAvatar: {
    alignItems: 'center',
    backgroundColor: colors.tealPale,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  contactAvatarText: { color: colors.tealDark, fontSize: 14, fontWeight: '800' },
  conversationCopy: { flex: 1, marginLeft: 12, minWidth: 0 },
  conversationTopLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  conversationName: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '800', marginRight: 8 },
  conversationTime: { color: colors.muted, fontSize: 9 },
  conversationSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  conversationBottomLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  conversationPreview: { color: colors.muted, flex: 1, fontSize: 10, marginRight: 8 },
  pendingPreview: { color: colors.ink, fontWeight: '700' },
  conversationArrow: { color: colors.muted, fontSize: 27, marginLeft: 4 },
  readOnlyNotice: {
    backgroundColor: colors.highlightSoft,
    borderRadius: 12,
    marginHorizontal: 18,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyText: { color: colors.ink, fontSize: 10, textAlign: 'center' },
  threadTopBar: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: 14,
  },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 34 },
  backButtonText: { color: colors.tealDark, fontSize: 34, lineHeight: 38 },
  threadTopCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  profileButton: { backgroundColor: colors.tealPale, borderRadius: 16, marginLeft: 8, paddingHorizontal: 11, paddingVertical: 8 },
  profileButtonText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  threadDetails: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 2,
  },
  threadDetailsText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  threadName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  threadStatus: { color: colors.muted, fontSize: 10, marginTop: 3 },
  threadMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  pendingBadge: { alignItems: 'center', backgroundColor: colors.highlight, borderRadius: 10, height: 20, justifyContent: 'center', minWidth: 20, paddingHorizontal: 5 },
  pendingBadgeText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  threadScroll: { flex: 1 },
  thread: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  messageRow: { alignItems: 'flex-start', flexDirection: 'row' },
  ownMessageRow: { justifyContent: 'flex-end' },
  bubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 5,
    borderRadius: 17,
    marginBottom: 9,
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  ownBubble: { backgroundColor: colors.tealDark, borderBottomLeftRadius: 17, borderBottomRightRadius: 5 },
  senderName: { color: colors.tealDark, fontSize: 10, fontWeight: '800', marginBottom: 4 },
  bubbleText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  ownBubbleText: { color: colors.white },
  bubbleTime: { color: colors.muted, fontSize: 9, marginTop: 5, textAlign: 'right' },
  ownBubbleTime: { color: colors.white },
  threadEmpty: {
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 18,
    maxWidth: 280,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  threadEmptyTitle: { color: colors.tealDark, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  threadEmptyText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 6, textAlign: 'center' },
  messagesLoading: { alignItems: 'center', alignSelf: 'center', marginBottom: 18 },
  messagesLoadingText: { color: colors.muted, fontSize: 11, marginTop: 8 },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composerInput: {
    backgroundColor: colors.canvas,
    borderRadius: 18,
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    maxHeight: 90,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: colors.tealDark,
    borderRadius: 18,
    marginLeft: 8,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabledButton: { opacity: 0.5 },
  sendButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  readOnlyFooter: {
    backgroundColor: colors.white,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  error: {
    backgroundColor: colors.tealPale,
    borderRadius: 10,
    color: colors.accent,
    fontSize: 11,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    textAlign: 'center',
  },
});
