import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenTransition } from '../components/ScreenTransition';
import { colors } from '../theme';

type Props = { onBegin: () => void };

export function WelcomeScreen({ onBegin }: Props) {
  return (
    <ScreenTransition>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandLockup}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>Q</Text>
          </View>
          <Text style={styles.brand}>Qualify</Text>
        </View>

        <View style={styles.illustration} accessible={false}>
          <View style={styles.orbit} />
          <View style={styles.smallDot} />
          <View style={styles.iconCircle}>
            <Ionicons color={colors.tealDark} name="heart" size={54} />
          </View>
          <View style={styles.trustCard}>
            <View style={styles.trustIcon}>
              <Ionicons color={colors.tealDark} name="checkmark" size={17} />
            </View>
            <View>
              <Text style={styles.trustTitle}>Cuidado confiable</Text>
              <Text style={styles.trustSubtitle}>Personas que están cerca</Text>
            </View>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>CUIDADO QUE CONECTA</Text>
          <Text style={styles.title}>Cuidar mejor,{'\n'}empieza aquí.</Text>
          <Text style={styles.description}>
            Encuentra el apoyo que tu familia necesita, con tranquilidad y confianza.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onBegin}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.primaryButtonText}>Comenzar</Text>
          <Ionicons color={colors.white} name="arrow-forward" size={19} />
        </Pressable>

        <Text style={styles.footer}>Cuidado cercano. Conexiones de confianza.</Text>
      </ScrollView>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 520,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 28,
    width: '100%',
  },
  brandLockup: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brandMarkText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  brand: { color: colors.ink, fontSize: 19, fontWeight: '800', marginLeft: 9 },
  illustration: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.tealPale,
    borderRadius: 34,
    height: 280,
    justifyContent: 'center',
    marginTop: 32,
    overflow: 'hidden',
    width: '100%',
  },
  orbit: {
    backgroundColor: colors.tealPale,
    borderRadius: 140,
    height: 240,
    position: 'absolute',
    right: -72,
    top: -90,
    width: 240,
  },
  smallDot: {
    backgroundColor: colors.highlightSoft,
    borderRadius: 13,
    height: 26,
    left: 34,
    position: 'absolute',
    top: 44,
    width: 26,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 72,
    elevation: 3,
    height: 144,
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    width: 144,
  },
  trustCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 15,
    bottom: 20,
    elevation: 2,
    flexDirection: 'row',
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    shadowColor: colors.ink,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  trustIcon: {
    alignItems: 'center',
    backgroundColor: colors.tealPale,
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    marginRight: 9,
    width: 28,
  },
  trustTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  trustSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  copy: { marginTop: 30 },
  eyebrow: { color: colors.tealDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40, marginTop: 9 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 10, maxWidth: 340 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.tealDark,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 26,
    minHeight: 54,
  },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '800', marginRight: 9 },
  footer: { color: colors.muted, fontSize: 11, marginTop: 19, textAlign: 'center' },
});
