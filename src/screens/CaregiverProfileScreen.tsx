import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Caregiver } from '../types';
import { colors } from '../theme';

type Props = {
  caregiver: Caregiver;
  onBack: () => void;
  onRequestCare: () => void;
  onMessage: () => void | Promise<void>;
  messageLoading?: boolean;
};

export function CaregiverProfileScreen({ caregiver, onBack, onRequestCare, onMessage, messageLoading }: Props) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Pressable accessibilityLabel="Volver" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>{"<"}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Guardar en favoritos" style={styles.favorite}>
            <Text style={styles.favoriteText}>Fav</Text>
          </Pressable>
          <Image source={{ uri: caregiver.image }} style={styles.photo} />
          <Text style={styles.name}>{caregiver.name}</Text>
          <Text style={styles.title}>{caregiver.title}</Text>
          <Text style={styles.location}>⌖  {caregiver.location} · a {caregiver.distance}</Text>
        </View>

        <View style={styles.stats}>
          <Stat value={caregiver.rating} label={`${caregiver.reviews} reseñas`} />
          <View style={styles.divider} />
          <Stat value={`${caregiver.yearsExperience} años`} label="de experiencia" />
          <View style={styles.divider} />
          <Stat value={`${caregiver.families}`} label="familias cuidadas" />
        </View>

        <Section title="¿En qué puedo ayudarte?">
          <View style={styles.chips}>
            {caregiver.specialties.map((specialty) => (
              <Text key={specialty} style={styles.chip}>{specialty}</Text>
            ))}
          </View>
        </Section>

        <Section title="Sobre mí">
          <Text style={styles.body}>{caregiver.about}</Text>
          <View style={styles.verifiedLine}>
            <Text style={styles.check}>•</Text>
            <Text style={styles.verifiedText}>Identidad verificada</Text>
          </View>
        </Section>

        <Section title="Disponibilidad">
          <View style={styles.availabilityCard}>
            <Text style={styles.calendar}>▦</Text>
            <View>
              <Text style={styles.availabilityTitle}>Hoy, desde las 14:00</Text>
              <Text style={styles.bodySmall}>Lun–Sáb · Mínimo 2 h</Text>
            </View>
            <Text style={styles.seeAgenda}>Ver agenda</Text>
          </View>
        </Section>

        <Section title="Las familias dicen">
          <View style={styles.reviewCard}>
            <Text style={styles.reviewText}>
              “Mi mamá se sintió en confianza desde el primer día. María es atenta y muy puntual.”
            </Text>
            <Text style={styles.reviewBy}>Lucía · hace 2 semanas</Text>
            <Text style={styles.stars}>{caregiver.rating}</Text>
          </View>
        </Section>
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>${caregiver.hourlyRate} <Text style={styles.priceUnit}>MXN / hora</Text></Text>
          <Text style={styles.bodySmall}>Sin cobro hasta confirmar</Text>
        </View>
        <Pressable onPress={onRequestCare} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Solicitar cuidado</Text>
        </Pressable>
        <Pressable disabled={messageLoading} onPress={onMessage} style={styles.requestButton}>
          <Text style={styles.requestText}>{messageLoading ? 'Abriendo...' : 'Enviar mensaje'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { paddingBottom: 18 },
  hero: { alignItems: 'center', backgroundColor: colors.tealPale, paddingBottom: 23, paddingTop: 52 },
  backButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 20, height: 38, justifyContent: 'center', left: 18, position: 'absolute', top: 12, width: 38 },
  backText: { color: colors.ink, fontSize: 31, lineHeight: 34, marginTop: -4 },
  favorite: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 20, height: 38, justifyContent: 'center', position: 'absolute', right: 18, top: 12, width: 38 },
  favoriteText: { color: colors.tealDark, fontSize: 21 },
  photo: { backgroundColor: colors.white, borderColor: colors.white, borderRadius: 48, borderWidth: 4, height: 96, width: 96 },
  name: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 11 },
  title: { color: colors.muted, fontSize: 12, marginTop: 3 },
  location: { color: colors.muted, fontSize: 11, marginTop: 8 },
  stats: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, marginTop: -1, paddingVertical: 15 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 9, marginTop: 4 },
  divider: { backgroundColor: colors.line, height: 28, width: 1 },
  section: { paddingHorizontal: 18, paddingTop: 20 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: colors.tealPale, borderRadius: 12, color: colors.tealDark, fontSize: 10, marginBottom: 7, marginRight: 6, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 7 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  verifiedLine: { alignItems: 'center', flexDirection: 'row', marginTop: 11 },
  check: { backgroundColor: colors.highlightSoft, borderRadius: 10, color: colors.ink, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2 },
  verifiedText: { color: colors.green, fontSize: 10, marginLeft: 6 },
  availabilityCard: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 13, flexDirection: 'row', padding: 12 },
  calendar: { color: colors.tealDark, fontSize: 20, marginRight: 11 },
  availabilityTitle: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  bodySmall: { color: colors.muted, fontSize: 9, marginTop: 4 },
  seeAgenda: { color: colors.tealDark, fontSize: 9, marginLeft: 'auto' },
  reviewCard: { backgroundColor: colors.white, borderRadius: 13, padding: 13 },
  reviewText: { color: colors.ink, fontSize: 11, fontStyle: 'italic', lineHeight: 17 },
  reviewBy: { color: colors.muted, fontSize: 9, marginTop: 8 },
  stars: { color: colors.gold, fontSize: 12, letterSpacing: 1, marginTop: 5 },
  bottom: { alignItems: 'center', backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12 },
  priceBlock: { flexShrink: 1 },
  price: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  priceUnit: { color: colors.muted, fontSize: 9, fontWeight: '400' },
  outlineButton: { borderColor: colors.tealDark, borderRadius: 20, borderWidth: 1, marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 12 },
  outlineButtonText: { color: colors.tealDark, fontSize: 10, fontWeight: '800' },
  requestButton: { backgroundColor: colors.teal, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 13 },
  requestText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
