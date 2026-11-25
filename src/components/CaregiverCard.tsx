import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Caregiver } from '../types';
import { secondaryColors as colors } from '../theme';

type Props = {
  caregiver: Caregiver;
  onPress: () => void;
  compact?: boolean;
};

export function CaregiverCard({ caregiver, onPress, compact = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, compact && styles.compactCard]}
    >
      <Image source={{ uri: caregiver.image }} style={styles.avatar} />
      <View style={styles.info}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={styles.name}>{caregiver.name}</Text>
          {caregiver.verified && <Ionicons color={colors.tealDark} name="checkmark-circle" size={15} />}
        </View>
        <Text style={styles.details}>
          <Text style={styles.rating}>Calif. {caregiver.rating}</Text> ({caregiver.reviews} opiniones) · {caregiver.distance}
        </Text>
        <View style={styles.availabilityRow}>
          <View style={[styles.availableDot, caregiver.availabilityTone === 'amber' && styles.busyDot]} />
          <Text numberOfLines={1} style={[styles.availability, caregiver.availabilityTone === 'amber' && styles.busyAvailability]}>
            {caregiver.availability}
          </Text>
        </View>
      </View>
      <View style={styles.priceBlock}>
        <Text style={styles.price}>${caregiver.hourlyRate}</Text>
        <Text style={styles.priceUnit}>MXN / hora</Text>
        <Ionicons color={colors.muted} name="chevron-forward" size={15} style={styles.chevron} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    marginBottom: 9,
    padding: 12,
    shadowColor: colors.ink,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  compactCard: { borderColor: colors.line, paddingVertical: 10 },
  avatar: { backgroundColor: colors.tealPale, borderRadius: 28, height: 56, width: 56 },
  info: { flex: 1, marginLeft: 11, minWidth: 0 },
  nameLine: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  name: { color: colors.ink, flexShrink: 1, fontSize: 13, fontWeight: '800' },
  details: { color: colors.muted, fontSize: 10, marginTop: 5 },
  rating: { color: colors.ink, fontWeight: '700' },
  availabilityRow: { alignItems: 'center', flexDirection: 'row', marginTop: 7 },
  availableDot: { backgroundColor: colors.green, borderRadius: 3, height: 6, marginRight: 5, width: 6 },
  busyDot: { backgroundColor: colors.gold },
  availability: { color: colors.green, flexShrink: 1, fontSize: 9, fontWeight: '600' },
  busyAvailability: { color: colors.ink },
  priceBlock: { alignItems: 'flex-end', marginLeft: 6, minWidth: 58 },
  price: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  priceUnit: { color: colors.muted, fontSize: 8, marginTop: 2 },
  chevron: { marginTop: 5 },
});
