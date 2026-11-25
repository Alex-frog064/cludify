import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getAbuelo, getGeocercas, getUltimaUbicacionAbuelo } from '../api/auth';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import { colors } from '../theme';
import type { Abuelo, Coordinates, MapMarker, Ubicacion } from '../types';

type Props = {
  abueloId: number;
  familiarNombre?: string;
  consultaId?: number;
  token?: string;
  onBack: () => void;
  onOpenChat?: () => void;
};

type GeocercaView = {
  abuelo_id: number;
  nombre?: string;
  latitud: number;
  longitud: number;
  direccion_formateada?: string | null;
  radio_metros?: number;
};

function ageFrom(nacimiento?: string | null) {
  if (!nacimiento) return null;
  const birth = new Date(nacimiento);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function timeAgo(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function ClientProfileScreen({ abueloId, familiarNombre, consultaId, token, onBack, onOpenChat }: Props) {
  const [paciente, setPaciente] = useState<Abuelo | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [geocerca, setGeocerca] = useState<GeocercaView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [abuelo, geocercas] = await Promise.all([
          getAbuelo(abueloId, token),
          getGeocercas(token).catch(() => [] as Record<string, unknown>[]),
        ]);
        if (!active) return;
        setPaciente(abuelo);
        const matched = geocercas
          .map((item) => ({
            abuelo_id: Number(item.abuelo_id),
            nombre: item.nombre == null ? undefined : String(item.nombre),
            latitud: Number(item.latitud),
            longitud: Number(item.longitud),
            direccion_formateada: item.direccion_formateada == null ? undefined : String(item.direccion_formateada),
            radio_metros: item.radio_metros == null ? undefined : Number(item.radio_metros),
          }))
          .find((item) => Number(item.latitud) && Number(item.longitud) && item.abuelo_id === abueloId);
        setGeocerca(matched ?? null);
        try {
          const last = await getUltimaUbicacionAbuelo(abueloId, token);
          if (active) setUbicacion(last);
        } catch {
          if (active) setUbicacion(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil del paciente.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => { void load(); }, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [abueloId, token]);

  const liveCoordinates: Coordinates | null = ubicacion
    && Number.isFinite(Number(ubicacion.latitud))
    && Number.isFinite(Number(ubicacion.longitud))
    ? { latitude: Number(ubicacion.latitud), longitude: Number(ubicacion.longitud) }
    : null;
  const fallbackCoordinates: Coordinates | null = geocerca
    && Number.isFinite(geocerca.latitud)
    && Number.isFinite(geocerca.longitud)
    ? { latitude: geocerca.latitud, longitude: geocerca.longitud }
    : null;
  const center = liveCoordinates ?? fallbackCoordinates;
  const name = paciente?.nombre ?? 'Paciente';
  const age = ageFrom(paciente?.nacimiento);
  const conditions = (paciente?.condiciones ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const markers: MapMarker[] = center
    ? [{
        id: 'paciente',
        label: initials(name),
        rate: 'Paciente',
        latitude: center.latitude,
        longitude: center.longitude,
        title: name,
        location: ubicacion?.direccion_formateada ?? geocerca?.direccion_formateada ?? undefined,
      }]
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.contentScroll}>
        <View style={styles.hero}>
          <Pressable accessibilityLabel="Volver" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>{'<'}</Text>
          </Pressable>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.subtitle}>
            {familiarNombre ? `Familiar: ${familiarNombre}` : 'Paciente registrado'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.tealDark} />
            <Text style={styles.muted}>Cargando datos del paciente...</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Datos del paciente</Text>
              <InfoRow label="Edad" value={age == null ? 'No registrada' : `${age} años`} />
              <InfoRow label="Nacimiento" value={paciente?.nacimiento ?? 'No registrado'} />
              <InfoRow label="Familiar" value={familiarNombre ?? String(paciente?.familiar_id ?? '—')} />
              <Text style={styles.fieldLabel}>Condiciones</Text>
              {conditions.length ? (
                <View style={styles.chips}>
                  {conditions.map((condition) => (
                    <Text key={condition} style={styles.chip}>{condition}</Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>Sin condiciones registradas.</Text>
              )}
              <Text style={styles.fieldLabel}>Descripción / notas</Text>
              <Text style={styles.body}>{paciente?.notas || 'El familiar no ha agregado una descripción.'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ubicación actual</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, !liveCoordinates && styles.statusDotFallback]} />
                <Text style={styles.statusText}>
                  {liveCoordinates
                    ? 'Última ubicación conocida'
                    : fallbackCoordinates
                      ? 'Zona de referencia (geocerca)'
                      : 'Sin ubicación disponible'}
                </Text>
              </View>
              <Text style={styles.address}>
                {ubicacion?.direccion_formateada
                  ?? geocerca?.direccion_formateada
                  ?? 'El dispositivo aún no ha reportado una dirección.'}
              </Text>
              {!!center && (
                <Text style={styles.coordinates}>
                  {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
                </Text>
              )}
              {!!ubicacion && (
                <View style={styles.metrics}>
                  <Metric label="Reporte" value={timeAgo(ubicacion.fecha) || '—'} />
                  <Metric label="Batería" value={ubicacion.bateria == null ? '—' : `${ubicacion.bateria}%`} />
                  <Metric label="Precisión" value={ubicacion.precision_metros == null ? '—' : `${ubicacion.precision_metros} m`} />
                </View>
              )}
              <View style={styles.mapWrap}>
                {center ? (
                  <OpenStreetMapView
                    center={center}
                    markers={markers}
                    showCurrentLocation={false}
                  />
                ) : (
                  <View style={styles.mapEmpty}>
                    <Text style={styles.muted}>Aún no hay coordenadas para mostrar en el mapa.</Text>
                  </View>
                )}
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </ScrollView>

      {onOpenChat && (
        <View style={styles.footer}>
          <Pressable onPress={onOpenChat} style={styles.chatButton}>
            <Text style={styles.chatButtonText}>
              {consultaId ? 'Volver a la conversación' : 'Enviar mensaje a la familia'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  contentScroll: { flex: 1 },
  content: { paddingBottom: 24 },
  hero: { alignItems: 'center', backgroundColor: colors.tealPale, paddingBottom: 22, paddingTop: 50 },
  backButton: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, height: 38, justifyContent: 'center', left: 18, position: 'absolute', top: 12, width: 38 },
  backText: { color: colors.ink, fontSize: 30, lineHeight: 33, marginTop: -4 },
  avatar: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 34, height: 68, justifyContent: 'center', width: 68 },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  card: { backgroundColor: colors.white, borderRadius: 18, marginHorizontal: 16, marginTop: 16, padding: 16 },
  cardTitle: { color: colors.tealDark, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  infoRow: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 9, marginBottom: 9 },
  infoLabel: { color: colors.muted, fontSize: 11 },
  infoValue: { color: colors.ink, fontSize: 11, fontWeight: '700', maxWidth: '65%', textAlign: 'right' },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginBottom: 7, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: colors.tealPale, borderRadius: 12, color: colors.tealDark, fontSize: 10, marginBottom: 6, marginRight: 6, paddingHorizontal: 10, paddingVertical: 6 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  muted: { color: colors.muted, fontSize: 11, marginTop: 8 },
  statusRow: { alignItems: 'center', flexDirection: 'row' },
  statusDot: { backgroundColor: colors.green, borderRadius: 5, height: 10, marginRight: 7, width: 10 },
  statusDotFallback: { backgroundColor: colors.gold },
  statusText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  address: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 9 },
  coordinates: { color: colors.muted, fontSize: 10, marginTop: 5 },
  metrics: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 13 },
  metric: { alignItems: 'center' },
  metricValue: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 9, marginTop: 3 },
  mapWrap: { borderRadius: 14, height: 250, marginTop: 14, overflow: 'hidden' },
  mapEmpty: { alignItems: 'center', backgroundColor: colors.map, flex: 1, justifyContent: 'center', padding: 20 },
  error: { color: colors.tealDark, fontSize: 11, marginHorizontal: 18, marginTop: 12, textAlign: 'center' },
  footer: { backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 11 },
  chatButton: { backgroundColor: colors.teal, borderRadius: 22, paddingVertical: 13 },
  chatButtonText: { color: colors.white, fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
