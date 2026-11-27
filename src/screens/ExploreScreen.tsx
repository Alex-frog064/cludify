import { Ionicons } from '@expo/vector-icons';
import { colors, createThemedStyles } from '../theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LocalizedText as Text } from '../components/LocalizedText';
import * as Location from 'expo-location';
import { ChevronRight, Star } from 'lucide-react-native';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import { Caregiver, Coordinates } from '../types';
import { filterNearbyCaregivers, nearbyRadiusKm } from '../utils/nearbyCaregivers';
import type { NearbyCaregiver } from '../utils/nearbyCaregivers';
import { loadVisibleCaregivers } from '../utils/visibleCaregivers';

type Props = { onSelectCaregiver: (caregiver: Caregiver) => void; token?: string };
type LocationStatus = 'loading' | 'ready' | 'denied' | 'error';
type Category = 'Todos' | 'Adultos mayores' | 'Enfermería' | 'Urgente';
type IconName = keyof typeof Ionicons.glyphMap;
type DiscoveryItem =
  | { id: string; type: 'heading'; section: 'featured' | 'nearby' }
  | { id: string; type: 'caregiver'; section: 'featured' | 'nearby'; caregiver: NearbyCaregiver }
  | { id: string; type: 'empty'; section: 'featured' | 'nearby' };

const categories: { label: Category; icon: IconName }[] = [
  { label: 'Todos', icon: 'apps-outline' },
  { label: 'Adultos mayores', icon: 'people-outline' },
  { label: 'Enfermería', icon: 'medkit-outline' },
  { label: 'Urgente', icon: 'alert-circle-outline' },
];
const radiusOptions = [5, 10, 20];
const defaultLocation: Coordinates = { latitude: 19.3869, longitude: -99.1627 };

export function ExploreScreen({ onSelectCaregiver, token }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('Todos');
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const [caregivers, setCaregivers] = useState<NearbyCaregiver[]>([]);
  const [caregiversLoading, setCaregiversLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [selectedCaregiver, setSelectedCaregiver] = useState<NearbyCaregiver | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState(nearbyRadiusKm);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const collapsedHeight = Math.min(340, Math.max(300, windowHeight * 0.42));
  const expandedHeight = Math.min(560, Math.max(collapsedHeight, windowHeight * 0.68));
  const [sheetHeight] = useState(() => new Animated.Value(collapsedHeight));

  useEffect(() => {
    const animation = Animated.spring(sheetHeight, {
      toValue: sheetExpanded ? expandedHeight : collapsedHeight,
      damping: 22,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [collapsedHeight, expandedHeight, sheetExpanded, sheetHeight]);

  const locateUser = useCallback(async () => {
    setLocationStatus('loading');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setCurrentLocation(null);
        setLocationStatus('denied');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationStatus('ready');
    } catch {
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
      setCaregiversLoading(true);
      try {
        const data = await loadVisibleCaregivers(token);
        if (!active) return;
        setCaregivers(data);
        setMapError('');
      } catch (error) {
        if (active) {
          setCaregivers([]);
          setMapError(error instanceof Error ? error.message : 'No se pudieron cargar cuidadores.');
        }
      } finally {
        if (active) setCaregiversLoading(false);
      }
    };

    void loadCaregivers();
    const interval = setInterval(() => { void loadCaregivers(); }, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token]);

  const filteredCaregivers = useMemo(() => {
    if (!token) return [];
    return filterNearbyCaregivers(caregivers, currentLocation)
      .filter((caregiver) => !currentLocation || caregiver.distanceKm == null || caregiver.distanceKm <= searchRadiusKm)
      .filter((caregiver) => matchesCategory(caregiver, activeCategory));
  }, [activeCategory, caregivers, currentLocation, searchRadiusKm, token]);

  const featuredCaregivers = useMemo(
    () => [...filteredCaregivers].sort((a, b) =>
      (Number.parseFloat(b.rating) || 0) - (Number.parseFloat(a.rating) || 0) || b.reviews - a.reviews),
    [filteredCaregivers],
  );

  const discoveryItems = useMemo<DiscoveryItem[]>(() => {
    const nearbyCaregivers = sheetExpanded ? filteredCaregivers : filteredCaregivers.slice(0, 2);
    return [
      { id: 'featured-heading', type: 'heading', section: 'featured' },
      ...(featuredCaregivers.length
        ? featuredCaregivers.map((caregiver) => ({
            id: `featured-${caregiver.id}`,
            type: 'caregiver' as const,
            section: 'featured' as const,
            caregiver,
          }))
        : [{ id: 'featured-empty', type: 'empty' as const, section: 'featured' as const }]),
      { id: 'nearby-heading', type: 'heading', section: 'nearby' },
      ...(nearbyCaregivers.length
        ? nearbyCaregivers.map((caregiver) => ({
            id: `nearby-${caregiver.id}`,
            type: 'caregiver' as const,
            section: 'nearby' as const,
            caregiver,
          }))
        : [{ id: 'nearby-empty', type: 'empty' as const, section: 'nearby' as const }]),
    ];
  }, [featuredCaregivers, filteredCaregivers, sheetExpanded]);

  const mapMarkers = useMemo(
    () => filteredCaregivers
      .filter((caregiver) => caregiver.lat != null && caregiver.lng != null)
      .map((caregiver) => ({
        id: caregiver.id,
        label: caregiver.name,
        rate: `$${caregiver.hourlyRate}/h`,
        latitude: caregiver.lat as number,
        longitude: caregiver.lng as number,
        title: caregiver.title,
        location: caregiver.location,
      })),
    [filteredCaregivers],
  );

  const handleMarkerPress = useCallback((id: string) => {
    const caregiver = filteredCaregivers.find((item) => item.id === id);
    if (!caregiver) return;
    setSelectedCaregiver(caregiver);
    setSheetExpanded(true);
  }, [filteredCaregivers]);

  const mapCenter = useMemo(() => {
    if (currentLocation) return currentLocation;
    if (selectedCaregiver?.lat != null && selectedCaregiver.lng != null) {
      return { latitude: selectedCaregiver.lat, longitude: selectedCaregiver.lng };
    }
    if (mapMarkers.length) {
      return { latitude: mapMarkers[0].latitude, longitude: mapMarkers[0].longitude };
    }
    return defaultLocation;
  }, [currentLocation, mapMarkers, selectedCaregiver]);

  const statusText = locationStatus === 'loading'
    ? 'Buscando tu ubicación'
    : locationStatus === 'denied'
      ? 'Cuidadores disponibles en tu zona'
      : locationStatus === 'error'
        ? 'Explorando zona de referencia'
        : 'Cuidadores disponibles en tu zona';

  const cycleSearchRadius = () => {
    setSearchRadiusKm((current) => {
      const currentIndex = radiusOptions.indexOf(current);
      return radiusOptions[(currentIndex + 1) % radiusOptions.length];
    });
  };

  const toggleSheet = () => {
    if (selectedCaregiver) {
      setSelectedCaregiver(null);
      setSheetExpanded(false);
      return;
    }
    setSheetExpanded((expanded) => !expanded);
  };

  const openSelectedProfile = () => {
    if (selectedCaregiver) onSelectCaregiver(selectedCaregiver);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.mapBackground}>
        <OpenStreetMapView
          center={mapCenter}
          markers={mapMarkers}
          onMarkerPress={handleMarkerPress}
          selectedMarkerId={selectedCaregiver?.id}
          showCurrentLocation={locationStatus === 'ready'}
        />
      </View>

      <View pointerEvents="none" style={styles.statusPill}>
        <View style={[styles.statusDot, locationStatus === 'ready' && styles.statusDotReady]} />
        <Text numberOfLines={1} style={styles.statusText}>{statusText}</Text>
        <View style={styles.statusCount}>
          <Text style={styles.statusCountText}>{filteredCaregivers.length}</Text>
        </View>
      </View>

      <View style={styles.mapFilters}>
        <ScrollView
          contentContainerStyle={styles.mapFilterContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {categories.map((category) => {
            const active = activeCategory === category.label;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={category.label}
                onPress={() => setActiveCategory(category.label)}
                style={[styles.mapFilter, active && styles.mapFilterActive]}
              >
                <Ionicons color={active ? colors.white : colors.ink} name={category.icon} size={14} />
                <Text style={[styles.mapFilterText, active && styles.mapFilterTextActive]}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.mapControls}>
        <MapAction
          accessibilityLabel="Centrar mapa en mi ubicación"
          icon="locate-outline"
          onPress={() => { void locateUser(); }}
        />
        <Pressable
          accessibilityLabel={`Cambiar radio de búsqueda, ${searchRadiusKm} kilómetros`}
          accessibilityRole="button"
          onPress={cycleSearchRadius}
          style={styles.radiusButton}
        >
          <Ionicons color={colors.ink} name="options-outline" size={18} />
          <Text style={styles.radiusText}>{searchRadiusKm} km</Text>
        </Pressable>
        <MapAction
          accessibilityLabel={sheetExpanded ? 'Contraer lista de cuidadores' : 'Abrir lista de cuidadores'}
          icon={sheetExpanded ? 'chevron-down' : 'list-outline'}
          onPress={() => {
            setSelectedCaregiver(null);
            setSheetExpanded((expanded) => !expanded);
          }}
        />
      </View>

      {!mapMarkers.length && (
        <View pointerEvents="none" style={styles.emptyMapMessage}>
          {token && caregiversLoading ? <ActivityIndicator color={colors.teal} size="small" /> : null}
          <Text style={styles.emptyMapText}>
            {!token
              ? 'Inicia sesión para ver cuidadores disponibles.'
              : mapError || 'Ajusta los filtros o el radio para explorar cuidadores.'}
          </Text>
        </View>
      )}

      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        <Pressable
          accessibilityLabel={selectedCaregiver ? 'Cerrar detalle' : sheetExpanded ? 'Contraer panel' : 'Expandir panel'}
          accessibilityRole="button"
          accessibilityState={{ expanded: sheetExpanded }}
          onPress={toggleSheet}
          style={styles.sheetHandleArea}
        >
          <View style={styles.sheetHandle} />
        </Pressable>

        {selectedCaregiver ? (
          <CaregiverDetail
            caregiver={selectedCaregiver}
            onOpenProfile={openSelectedProfile}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.discoveryListContent}
            data={discoveryItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.type === 'heading') {
                if (item.section === 'featured') {
                  return (
                    <View style={styles.featuredHeading}>
                      <Text style={styles.featuredTitle}>Top cuidadores</Text>
                      <Text style={styles.featuredSubtitle}>Perfiles mejor valorados</Text>
                    </View>
                  );
                }
                return (
                  <View style={styles.sheetHeading}>
                    <View style={styles.sheetHeadingCopy}>
                      <Text style={styles.sheetTitle}>Cuidadores cercanos</Text>
                      <Text style={styles.sheetSubtitle}>
                        {currentLocation ? 'Ordenados por distancia' : 'Explora opciones de cuidado en tu zona'}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={sheetExpanded ? 'Ver menos cuidadores' : 'Ver todos los cuidadores'}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: sheetExpanded }}
                      onPress={() => setSheetExpanded((expanded) => !expanded)}
                      style={styles.seeAllButton}
                    >
                      <Text style={styles.seeAllText}>{sheetExpanded ? 'Ver menos' : 'Ver todos'}</Text>
                      <ChevronRight color={colors.muted} size={16} strokeWidth={2} />
                    </Pressable>
                  </View>
                );
              }

              if (item.type === 'empty') {
                if (item.section === 'featured') {
                  return (
                    <View style={styles.featuredEmpty}>
                      {token && caregiversLoading ? (
                        <ActivityIndicator color={colors.teal} size="small" />
                      ) : (
                        <Text style={styles.emptyListText}>
                          {token ? mapError || 'No hay perfiles destacados en esta categoría.' : 'Inicia sesión para descubrir cuidadores.'}
                        </Text>
                      )}
                    </View>
                  );
                }
                return (
                  <View style={styles.emptyList}>
                    {token && caregiversLoading ? <ActivityIndicator color={colors.teal} size="small" /> : (
                      <>
                        <Ionicons color={colors.muted} name="location-outline" size={21} />
                        <Text style={styles.emptyListText}>
                          {!token
                            ? 'Inicia sesión para descubrir cuidadores.'
                            : mapError || 'No hay cuidadores en esta categoría y radio.'}
                        </Text>
                      </>
                    )}
                  </View>
                );
              }

              const onPress = () => {
                setSelectedCaregiver(item.caregiver);
                setSheetExpanded(true);
              };
              return item.section === 'featured'
                ? <FeaturedCaregiverCard caregiver={item.caregiver} onPress={onPress} />
                : <CaregiverListItem caregiver={item.caregiver} onPress={onPress} />;
            }}
            showsVerticalScrollIndicator={false}
            style={styles.caregiverListScroll}
          />
        )}
      </Animated.View>
    </View>
  );
}

function matchesCategory(caregiver: NearbyCaregiver, category: Category) {
  if (category === 'Todos') return true;
  const searchable = `${caregiver.title} ${caregiver.specialties.join(' ')} ${caregiver.about}`.toLowerCase();
  if (category === 'Adultos mayores') return /adult|mayor|geriat|cuidador|cuidado/.test(searchable);
  if (category === 'Enfermería') return /enfermer|medic|salud|cl[ií]nic/.test(searchable);
  return /urgente|urgencia|prioridad/.test(searchable);
}

function MapAction({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.mapAction}
    >
      <Ionicons color={colors.ink} name={icon} size={19} />
    </Pressable>
  );
}

function FeaturedCaregiverCard({
  caregiver,
  onPress,
}: {
  caregiver: NearbyCaregiver;
  onPress: () => void;
}) {
  const available = caregiver.availabilityTone !== 'amber';
  return (
    <Pressable
      accessibilityLabel={`Ver perfil de ${caregiver.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.featuredCard}
    >
      <View style={styles.featuredAvatar}>
        <Image resizeMode="cover" source={{ uri: caregiver.image }} style={styles.featuredAvatarImage} />
      </View>
      <View style={styles.featuredInfo}>
        <View style={styles.featuredNameLine}>
          <Text numberOfLines={1} style={styles.featuredName}>{caregiver.name}</Text>
          {caregiver.verified && <Ionicons color={colors.teal} name="checkmark-circle" size={14} />}
        </View>
        <Text numberOfLines={1} style={styles.featuredRole}>
          {caregiver.specialties[0] || caregiver.title}
        </Text>
        <View style={styles.featuredMeta}>
          <View style={[styles.featuredStatus, !available && styles.featuredStatusBusy]}>
            <View style={[styles.featuredStatusDot, !available && styles.featuredStatusDotBusy]} />
            <Text style={styles.featuredStatusText}>{available ? 'Disponible' : 'En servicio'}</Text>
          </View>
          <View style={styles.featuredRating}>
            <Star color={colors.secondary} fill={colors.secondary} size={13} strokeWidth={1.8} />
            <Text style={styles.featuredRatingText}>{caregiver.rating}</Text>
          </View>
        </View>
      </View>
      <View style={styles.featuredPriceBlock}>
        <Text style={styles.featuredPrice}>${caregiver.hourlyRate}<Text style={styles.featuredPriceUnit}>/h</Text></Text>
      </View>
    </Pressable>
  );
}

function CaregiverListItem({ caregiver, onPress }: { caregiver: NearbyCaregiver; onPress: () => void }) {
  const available = caregiver.availabilityTone !== 'amber';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.caregiverRow}>
      <View style={styles.caregiverAvatar}>
        <Image resizeMode="cover" source={{ uri: caregiver.image }} style={styles.caregiverAvatarImage} />
      </View>
      <View style={styles.caregiverInfo}>
        <View style={styles.caregiverNameLine}>
          <Text numberOfLines={1} style={styles.caregiverName}>{caregiver.name}</Text>
          {caregiver.verified && <Ionicons color={colors.teal} name="checkmark-circle" size={14} />}
          <View style={styles.rating}>
            <Star color={colors.secondary} fill={colors.secondary} size={12} strokeWidth={1.8} />
            <Text style={styles.ratingText}>{caregiver.rating}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.caregiverTitle}>{caregiver.title}</Text>
        <View style={styles.availabilityLine}>
          <View style={[styles.availabilityBadge, !available && styles.availabilityBadgeBusy]}>
            <View style={[styles.availabilityDot, !available && styles.availabilityDotBusy]} />
            <Text style={[styles.availabilityText, !available && styles.availabilityTextBusy]}>
              {available ? 'Disponible ahora' : 'En servicio'}
            </Text>
          </View>
          <Text style={styles.distanceText}>{caregiver.distance}</Text>
        </View>
      </View>
      <View style={styles.rowAction}>
        <ChevronRight color={colors.ink} size={18} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function CaregiverDetail({
  caregiver,
  onOpenProfile,
}: {
  caregiver: NearbyCaregiver;
  onOpenProfile: () => void;
}) {
  const available = caregiver.availabilityTone !== 'amber';
  return (
    <View style={styles.detailContent}>
      <View style={styles.detailTopline}>
        <View style={styles.detailIdentity}>
          <View style={styles.detailAvatar}>
            <Image resizeMode="cover" source={{ uri: caregiver.image }} style={styles.detailAvatarImage} />
          </View>
          <View style={styles.detailNameCopy}>
            <Text numberOfLines={1} style={styles.detailName}>{caregiver.name}</Text>
            <Text numberOfLines={1} style={styles.detailCategory}>{caregiver.title}</Text>
          </View>
        </View>
        <View style={styles.ratingPill}>
          <Star color={colors.secondary} fill={colors.secondary} size={13} strokeWidth={1.8} />
          <Text style={styles.ratingPillText}>{caregiver.rating}</Text>
        </View>
      </View>

      <View style={styles.detailAvailability}>
        <View style={styles.detailAvailabilityLine}>
          <Text style={styles.detailSectionLabel}>Disponibilidad</Text>
          <Text style={[styles.detailAvailabilityText, !available && styles.availabilityTextBusy]}>
            {available ? 'Disponible ahora' : 'En servicio'}
          </Text>
        </View>
        <View style={styles.detailAvailabilityTrack}>
          <View style={[styles.detailAvailabilityFill, !available && styles.detailAvailabilityFillBusy]} />
        </View>
      </View>

      <View style={styles.detailLocation}>
        <Ionicons color={colors.teal} name="location-outline" size={17} />
        <Text numberOfLines={1} style={styles.detailLocationText}>
          {caregiver.location} · {caregiver.distance}
        </Text>
        <Text style={styles.detailPrice}>${caregiver.hourlyRate}<Text style={styles.detailPriceUnit}>/h</Text></Text>
      </View>

      <Pressable accessibilityRole="button" onPress={onOpenProfile} style={styles.profileButton}>
        <Text style={styles.profileButtonText}>Ver perfil completo</Text>
        <Ionicons color={colors.white} name="arrow-forward" size={17} />
      </Pressable>
    </View>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  screen: { backgroundColor: colors.map, flex: 1, overflow: 'hidden' },
  mapBackground: StyleSheet.absoluteFill,
  statusPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    left: 18,
    maxWidth: '84%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    position: 'absolute',
    right: 18,
    top: 10,
  },
  statusDot: { backgroundColor: colors.secondary, borderRadius: 4, height: 8, marginRight: 8, width: 8 },
  statusDotReady: { backgroundColor: colors.teal },
  statusText: { color: colors.ink, flexShrink: 1, fontSize: 11, fontWeight: '700' },
  statusCount: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 10, height: 21, justifyContent: 'center', marginLeft: 8, minWidth: 24, paddingHorizontal: 6 },
  statusCountText: { color: colors.teal, fontSize: 10, fontWeight: '800' },
  mapFilters: { left: 12, position: 'absolute', right: 66, top: 56 },
  mapFilterContent: { alignItems: 'center', paddingRight: 5 },
  mapFilter: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginRight: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  mapFilterActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  mapFilterText: { color: colors.ink, fontSize: 10, fontWeight: '700', marginLeft: 5 },
  mapFilterTextActive: { color: colors.white },
  mapControls: { alignItems: 'center', position: 'absolute', right: 12, top: 109 },
  mapAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 43,
    justifyContent: 'center',
    marginBottom: 9,
    width: 43,
  },
  radiusButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    marginBottom: 9,
    width: 48,
  },
  radiusText: { color: colors.ink, fontSize: 9, fontWeight: '800', marginTop: 2 },
  emptyMapMessage: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: 'row',
    left: 62,
    maxWidth: 210,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    top: '39%',
  },
  emptyMapText: { color: colors.muted, flexShrink: 1, fontSize: 10, lineHeight: 15, marginLeft: 7, textAlign: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    paddingHorizontal: 17,
    position: 'absolute',
    right: 0,
  },
  sheetHandleArea: { alignItems: 'center', height: 22, justifyContent: 'center' },
  sheetHandle: { backgroundColor: colors.line, borderRadius: 3, height: 4, width: 38 },
  discoveryListContent: { paddingBottom: 34 },
  featuredHeading: { marginBottom: 8, marginTop: 2 },
  featuredTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  featuredSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  featuredCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    minHeight: 76,
    padding: 10,
    width: '100%',
  },
  featuredAvatar: { backgroundColor: colors.tealPale, borderRadius: 22, height: 44, overflow: 'hidden', width: 44 },
  featuredAvatarImage: { height: '100%', width: '100%' },
  featuredInfo: { flex: 1, marginLeft: 10, minWidth: 0 },
  featuredStatus: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 11, flexDirection: 'row', paddingHorizontal: 7, paddingVertical: 5 },
  featuredStatusBusy: { backgroundColor: colors.canvas },
  featuredStatusDot: { backgroundColor: colors.secondary, borderRadius: 3, height: 6, marginRight: 4, width: 6 },
  featuredStatusDotBusy: { backgroundColor: colors.line },
  featuredStatusText: { color: colors.tealDark, fontSize: 8, fontWeight: '700' },
  featuredNameLine: { alignItems: 'center', flexDirection: 'row', gap: 4, minWidth: 0 },
  featuredName: { color: colors.ink, flexShrink: 1, fontSize: 11, fontWeight: '800' },
  featuredRole: { color: colors.muted, fontSize: 9 },
  featuredMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  featuredRating: { alignItems: 'center', flexDirection: 'row', marginLeft: 7 },
  featuredRatingText: { color: colors.ink, fontSize: 9, fontWeight: '700', marginLeft: 4 },
  featuredPriceBlock: { alignItems: 'flex-end', borderLeftColor: colors.line, borderLeftWidth: 1, justifyContent: 'center', marginLeft: 8, minWidth: 54, paddingLeft: 8 },
  featuredPrice: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  featuredPriceUnit: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  featuredEmpty: { alignItems: 'center', justifyContent: 'center', marginBottom: 12, paddingHorizontal: 12, paddingVertical: 14 },
  sheetHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, marginTop: 12 },
  sheetHeadingCopy: { flex: 1 },
  sheetTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  sheetSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  seeAllButton: { alignItems: 'center', flexDirection: 'row', marginLeft: 8, paddingVertical: 6 },
  seeAllText: { color: colors.secondary, fontSize: 10, fontWeight: '800' },
  caregiverListScroll: { flex: 1, minHeight: 0 },
  caregiverRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', minHeight: 70, paddingVertical: 8 },
  caregiverAvatar: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 23, height: 46, justifyContent: 'center', overflow: 'hidden', width: 46 },
  caregiverAvatarImage: { height: '100%', width: '100%' },
  caregiverInfo: { flex: 1, marginLeft: 10, minWidth: 0 },
  caregiverNameLine: { alignItems: 'center', flexDirection: 'row' },
  caregiverName: { color: colors.ink, flexShrink: 1, fontSize: 12, fontWeight: '800', marginRight: 4 },
  rating: { alignItems: 'center', flexDirection: 'row', marginLeft: 'auto' },
  ratingText: { color: colors.ink, fontSize: 10, fontWeight: '700', marginLeft: 3 },
  caregiverTitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  availabilityLine: { alignItems: 'center', flexDirection: 'row', marginTop: 7 },
  availabilityBadge: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 10, flexDirection: 'row', paddingHorizontal: 7, paddingVertical: 4 },
  availabilityBadgeBusy: { backgroundColor: colors.canvas },
  availabilityDot: { backgroundColor: colors.secondary, borderRadius: 3, height: 6, marginRight: 4, width: 6 },
  availabilityDotBusy: { backgroundColor: colors.line },
  availabilityText: { color: colors.tealDark, fontSize: 8, fontWeight: '700' },
  availabilityTextBusy: { color: colors.muted },
  distanceText: { color: colors.line, fontSize: 9, marginLeft: 'auto' },
  rowAction: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 17, height: 34, justifyContent: 'center', marginLeft: 9, width: 34 },
  emptyList: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 20 },
  emptyListText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginLeft: 8, textAlign: 'center' },
  detailContent: { flex: 1 },
  detailTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  detailIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', minWidth: 0 },
  detailAvatar: { backgroundColor: colors.tealPale, borderRadius: 26, height: 52, overflow: 'hidden', width: 52 },
  detailAvatarImage: { height: '100%', width: '100%' },
  detailNameCopy: { flex: 1, marginLeft: 10, minWidth: 0 },
  detailName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  detailCategory: { color: colors.muted, fontSize: 11, marginTop: 4 },
  ratingPill: { alignItems: 'center', backgroundColor: colors.highlightSoft, borderRadius: 13, flexDirection: 'row', marginLeft: 9, paddingHorizontal: 9, paddingVertical: 7 },
  ratingPillText: { color: colors.ink, fontSize: 11, fontWeight: '800', marginLeft: 4 },
  detailAvailability: { marginBottom: 12 },
  detailAvailabilityLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailSectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  detailAvailabilityText: { color: colors.teal, fontSize: 10, fontWeight: '800' },
  detailAvailabilityTrack: { backgroundColor: colors.line, borderRadius: 4, height: 7, overflow: 'hidden' },
  detailAvailabilityFill: { backgroundColor: colors.teal, borderRadius: 4, height: '100%', width: '86%' },
  detailAvailabilityFillBusy: { backgroundColor: colors.line, width: '48%' },
  detailLocation: { alignItems: 'center', flexDirection: 'row', marginBottom: 13 },
  detailLocationText: { color: colors.muted, flex: 1, fontSize: 10, marginLeft: 6 },
  detailPrice: { color: colors.ink, fontSize: 15, fontWeight: '800', marginLeft: 8 },
  detailPriceUnit: { color: colors.muted, fontSize: 9, fontWeight: '500' },
  profileButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', minHeight: 46 },
  profileButtonText: { color: colors.white, fontSize: 12, fontWeight: '800', marginRight: 8 },
}));
