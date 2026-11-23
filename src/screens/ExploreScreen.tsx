import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as Location from 'expo-location';
import { CaregiverCard } from '../components/CaregiverCard';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import { getCuidadoresMapa } from '../api/auth';
import { Caregiver, Coordinates } from '../types';
import { colors } from '../theme';
import { filterNearbyCaregivers, mapCaregiver, nearbyRadiusKm } from '../utils/nearbyCaregivers';
import type { NearbyCaregiver } from '../utils/nearbyCaregivers';

type Props = { onSelectCaregiver: (caregiver: Caregiver) => void; token?: string };
type LocationStatus = 'loading' | 'ready' | 'denied' | 'error';
type FilterIcon = 'time-outline' | 'heart-outline' | 'options-outline';

const filters: { label: string; icon: FilterIcon }[] = [
  { label: 'Hoy', icon: 'time-outline' },
  { label: 'Especialidad', icon: 'heart-outline' },
  { label: 'Filtros', icon: 'options-outline' },
];
const defaultLocation: Coordinates = { latitude: 19.3869, longitude: -99.1627 };

export function ExploreScreen({ onSelectCaregiver, token }: Props) {
  const [activeFilter, setActiveFilter] = useState('Hoy');
  const [location, setLocation] = useState('Mi ubicación');
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const [showCaregivers, setShowCaregivers] = useState(false);
  const [caregivers, setCaregivers] = useState<NearbyCaregiver[]>([]);
  const [mapError, setMapError] = useState('');
  const { height: windowHeight } = useWindowDimensions();

  const locateUser = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocation('Zona de ejemplo · Del Valle');
        setLocationStatus('denied');
        return;
      }

      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      setCurrentLocation(coords);
      setLocation('Mi ubicación actual');
      setLocationStatus('ready');
    } catch {
      setLocation('Zona de ejemplo · Del Valle');
      setLocationStatus('error');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void locateUser(); }, 0);
    return () => clearTimeout(timer);
  }, [locateUser]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadCaregivers = async () => {
      try {
        const data = await getCuidadoresMapa(token);
        if (!active) return;
        setCaregivers(data.map(mapCaregiver).filter((c): c is NearbyCaregiver => !!c));
        setMapError('');
      } catch (e) {
        if (active) {
          setCaregivers([]);
          setMapError(e instanceof Error ? e.message : 'No se pudieron cargar cuidadores.');
        }
      }
    };
    void loadCaregivers();
    const interval = setInterval(() => { void loadCaregivers(); }, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [token]);

  const visibleCaregivers = useMemo(() => {
    if (!token) return [];
    return filterNearbyCaregivers(caregivers, currentLocation);
  }, [caregivers, token, currentLocation]);
  const mapMarkers = useMemo(
    () => visibleCaregivers.filter((c) => c.lat != null && c.lng != null).map((c) => ({
      id: c.id,
      label: c.name,
      rate: `$${c.hourlyRate}/h`,
      latitude: c.lat as number,
      longitude: c.lng as number,
      title: c.title,
      location: c.location,
    })),
    [visibleCaregivers],
  );
  const handleMarkerPress = useCallback((id: string) => {
    const caregiver = visibleCaregivers.find((item) => item.id === id);
    if (caregiver) onSelectCaregiver(caregiver);
  }, [visibleCaregivers, onSelectCaregiver]);
  const locationCenter = useMemo(() => {
    if (currentLocation) return currentLocation;
    if (mapMarkers.length) return { latitude: mapMarkers[0].latitude, longitude: mapMarkers[0].longitude };
    return defaultLocation;
  }, [currentLocation, mapMarkers]);
  const mapHeight = Math.min(460, Math.max(280, windowHeight * (showCaregivers ? 0.28 : 0.54)));
  const statusText = {
    loading: 'Buscando tu ubicación…',
    ready: 'Ubicación actual',
    denied: 'Activa el permiso para mostrar tu ubicación',
    error: 'No se pudo obtener tu ubicación',
  }[locationStatus];

  const handleLocatePress = () => {
    setLocationStatus('loading');
    void locateUser();
    if (locationStatus === 'denied') {
      Alert.alert('Permiso de ubicación', 'Permite el acceso a tu ubicación para centrar el mapa.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandLine}>
            <View style={styles.brandLockup}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>Q</Text></View>
              <Text style={styles.brand}>Qualify</Text>
            </View>
            <View style={styles.trustBadge}>
              <Ionicons color={colors.tealDark} name="shield-checkmark-outline" size={14} />
              <Text style={styles.trustText}>Cuidado confiable</Text>
            </View>
          </View>
          <Text style={styles.eyebrow}>CUIDADO CERCA DE TI</Text>
          <Text style={styles.heading}>Buen cuidado,{'\n'}cerca de ti</Text>
          <View style={styles.search}>
            <View style={styles.searchIcon}>
              <Ionicons color={colors.tealDark} name="location-outline" size={19} />
            </View>
            <View style={styles.searchCopy}>
              <Text style={styles.searchLabel}>TU UBICACIÓN</Text>
              <TextInput
                accessibilityLabel="Ubicación"
                onChangeText={setLocation}
                placeholder="¿Dónde necesitas cuidado?"
                placeholderTextColor="#839497"
                style={styles.locationInput}
                value={location}
              />
            </View>
            <Ionicons color={colors.muted} name="chevron-down" size={16} />
          </View>
        </View>

        <View style={[styles.mapContainer, { height: mapHeight }]}>
          <OpenStreetMapView
            center={locationCenter}
            markers={mapMarkers}
            onMarkerPress={handleMarkerPress}
            showCurrentLocation={locationStatus === 'ready'}
          />
          {!mapMarkers.length ? (
            <Text style={styles.noMapText}>
              {!token
                ? 'Inicia sesión para ver los cuidadores en el mapa.'
                : mapError || (currentLocation
                  ? `No hay cuidadores activos a menos de ${nearbyRadiusKm} km. Deben estar verificados y con ubicación reciente (2 min).`
                  : 'No hay cuidadores activos en el mapa. Activa la ubicación para filtrar por cercanía.')}
            </Text>
          ) : null}

          <View style={styles.filterRow}>
            {filters.map((filter) => (
              <Pressable
                key={filter.label}
                onPress={() => setActiveFilter(filter.label)}
                style={[styles.filterChip, activeFilter === filter.label && styles.activeFilterChip]}
              >
                <Ionicons
                  color={activeFilter === filter.label ? colors.white : colors.ink}
                  name={filter.icon}
                  size={13}
                />
                <Text style={[styles.filterText, activeFilter === filter.label && styles.activeFilterText]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.mapStatus}>
            <View style={[styles.statusDot, locationStatus === 'ready' && styles.readyDot]} />
            <Text style={styles.mapStatusText}>{statusText}</Text>
          </View>
          <Pressable
            accessibilityLabel="Centrar mapa en mi ubicación"
            onPress={handleLocatePress}
            style={styles.mapControl}
          >
            <Ionicons color={colors.ink} name="locate-outline" size={19} />
          </Pressable>
        </View>

        <View style={[styles.results, !showCaregivers && styles.collapsedResults]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showCaregivers }}
            onPress={() => setShowCaregivers((expanded) => !expanded)}
            style={styles.resultsHeading}
          >
            <View>
              <Text style={styles.resultsTitle}>Cuidadores destacados</Text>
              <Text style={styles.resultsSubtitle}>
                {currentLocation
                  ? showCaregivers
                    ? `Hasta ${nearbyRadiusKm} km desde tu ubicación`
                    : `Toca para ver perfiles a ${nearbyRadiusKm} km a la redonda`
                  : showCaregivers
                    ? 'Ubicación desactivada · se muestran todos'
                    : 'Toca para ver los perfiles disponibles'}
              </Text>
            </View>
            <View style={styles.resultsActions}>
              <View style={styles.resultsCount}>
                <Ionicons color={colors.tealDark} name="people-outline" size={13} />
                  <Text style={styles.resultsCountText}>{visibleCaregivers.length}</Text>
              </View>
              <Ionicons
                color={colors.tealDark}
                name={showCaregivers ? 'chevron-down' : 'chevron-up'}
                size={18}
              />
            </View>
          </Pressable>
          {showCaregivers && (
            <>
          <View style={styles.resultsHeading}>
            <Text style={styles.sectionEyebrow}>DISPONIBLES CERCA DE TI</Text>
          </View>
          {visibleCaregivers.map((caregiver, index) => (
            <CaregiverCard
              caregiver={caregiver}
              key={caregiver.id}
              onPress={() => onSelectCaregiver(caregiver)}
              compact={index > 0}
            />
          ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  scrollContent: { paddingBottom: 10 },
  header: { backgroundColor: colors.canvas, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  brandLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brandLockup: { alignItems: 'center', flexDirection: 'row' },
  brandMark: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 11, height: 30, justifyContent: 'center', width: 30 },
  brandMarkText: { color: colors.white, fontSize: 17, fontWeight: '900' },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: 0.1, marginLeft: 8 },
  trustBadge: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderRadius: 13, borderWidth: 1, flexDirection: 'row', paddingHorizontal: 9, paddingVertical: 7 },
  trustText: { color: colors.tealDark, fontSize: 9, fontWeight: '700', marginLeft: 5 },
  eyebrow: { color: colors.tealDark, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 15 },
  heading: { color: colors.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.5, lineHeight: 29, marginTop: 5 },
  search: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    height: 56,
    marginTop: 13,
    paddingHorizontal: 10,
    shadowColor: '#173A3E',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 9,
    elevation: 1,
  },
  searchIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  searchCopy: { flex: 1, marginLeft: 10 },
  searchLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  locationInput: { color: colors.ink, fontSize: 11, fontWeight: '600', height: 21, marginTop: 2, padding: 0 },
  mapContainer: {
    borderRadius: 21,
    elevation: 2,
    marginHorizontal: 14,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#173A3E',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  filterRow: { flexDirection: 'row', left: 11, position: 'absolute', top: 11 },
  filterChip: { alignItems: 'center', backgroundColor: colors.white, borderColor: 'rgba(24,56,59,0.07)', borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginRight: 6, paddingHorizontal: 10, paddingVertical: 8 },
  activeFilterChip: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { color: colors.ink, fontSize: 9, fontWeight: '700', marginLeft: 5 },
  activeFilterText: { color: colors.white },
  mapStatus: {
    backgroundColor: colors.white,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    bottom: 12,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    position: 'absolute',
  },
  statusDot: { backgroundColor: colors.gold, borderRadius: 3, height: 6, marginRight: 6, width: 6 },
  readyDot: { backgroundColor: colors.green },
  mapStatusText: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  noMapText: { position: 'absolute', top: 52, left: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: 8, color: colors.muted, fontSize: 10, textAlign: 'center' },
  mapControl: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    bottom: 12,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    width: 34,
  },
  results: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 21, borderWidth: 1, marginHorizontal: 14, marginTop: 13, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 5 },
  resultsHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  collapsedResults: { paddingBottom: 12 },
  resultsActions: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  resultsTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  resultsSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
  resultsCount: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 12, flexDirection: 'row', paddingHorizontal: 9, paddingVertical: 7 },
  resultsCountText: { color: colors.tealDark, fontSize: 9, fontWeight: '700', marginLeft: 5 },
  sectionEyebrow: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
});
