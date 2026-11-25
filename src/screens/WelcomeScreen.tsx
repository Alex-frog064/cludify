import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ScreenTransition } from '../components/ScreenTransition';
import { colors } from '../theme';

type Props = { onBegin: () => void };

export function WelcomeScreen({ onBegin }: Props) {
  const [exitOpacity] = useState(() => new Animated.Value(1));
  const [exitOffset] = useState(() => new Animated.Value(0));
  const [isTransitioning, setIsTransitioning] = useState(false);

  const beginLogin = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    Animated.parallel([
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(exitOffset, {
        toValue: -16,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(({ finished }) => {
      if (finished) onBegin();
      else setIsTransitioning(false);
    });
  };

  return (
    <ScreenTransition style={styles.screen}>
      <Animated.View
        style={[
          styles.screen,
          { opacity: exitOpacity, transform: [{ translateY: exitOffset }] },
        ]}
      >
        <Image
          accessible={false}
          resizeMode="cover"
          source={require('../IMG/image.png')}
          style={styles.backgroundImage}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>CUIDADO QUE CONECTA</Text>
          <Text style={styles.title}>Cuidar mejor,{'\n'}empieza aquí.</Text>
          <Text style={styles.description}>
            Encuentra el apoyo que tu familia necesita, con tranquilidad y confianza.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={isTransitioning}
            onPress={beginLogin}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>Comenzar</Text>
            <Ionicons color={colors.white} name="arrow-forward" size={19} />
          </Pressable>
        </ScrollView>
      </Animated.View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.white, flex: 1 },
  backgroundImage: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 520,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  eyebrow: { color: colors.tealDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.tealDark, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40, marginTop: 9 },
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
});
