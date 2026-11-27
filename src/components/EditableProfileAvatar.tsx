import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Animated, Image, Pressable, View, StyleSheet } from 'react-native';
import { LocalizedText as Text } from './LocalizedText';
import { Camera } from 'lucide-react-native';
import { secondaryColors , createThemedStyles} from '../theme';
import { useAppSettings } from '../context/AppSettingsContext';
import { showLocalizedAlert } from '../utils/localizedAlert';

type Props = {
  uri?: string;
  name: string;
  size: number;
  onChange: (uri: string) => void;
};

export function EditableProfileAvatar({ uri, name, size, onChange }: Props) {
  const { language } = useAppSettings();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!uri) return;
    scale.setValue(0.94);
    opacity.setValue(0.65);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 190, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, uri]);

  const pickPhoto = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showLocalizedAlert(
            language,
            'Permiso de cámara',
            permission.canAskAgain
              ? 'Permite el acceso a la cámara para tomar tu foto de perfil.'
              : 'Activa el permiso de cámara desde los ajustes del dispositivo.',
          );
          return;
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });

      if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
    } catch (error) {
      showLocalizedAlert(
        language,
        'No se pudo seleccionar la foto',
        error instanceof Error ? error.message : 'Intenta de nuevo.',
      );
    }
  };

  const askForPhoto = () => {
    showLocalizedAlert(language, 'Foto de perfil', 'Elige cómo quieres agregar tu foto.', [
      { text: 'Tomar foto', onPress: () => { void pickPhoto('camera'); } },
      { text: 'Elegir de galería', onPress: () => { void pickPhoto('library'); } },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      accessibilityHint="Elige una imagen de la galería o toma una foto nueva"
      accessibilityLabel="Cambiar foto de perfil"
      accessibilityRole="button"
      onPress={askForPhoto}
      style={[
        styles.frame,
        { borderRadius: size / 2, height: size, width: size },
      ]}
    >
      <Animated.View
        style={[
          styles.imageWrap,
          { borderRadius: size / 2, height: size - 8, opacity, transform: [{ scale }], width: size - 8 },
        ]}
      >
        {uri ? (
          <Image
            resizeMode="cover"
            source={{ uri }}
            style={{ borderRadius: (size - 8) / 2, height: size - 8, width: size - 8 }}
          />
        ) : (
          <Text style={[styles.initial, { fontSize: size * 0.37 }]}>{name.charAt(0).toUpperCase() || '?'}</Text>
        )}
      </Animated.View>
      <View style={styles.cameraBadge}>
        <Camera color={secondaryColors.white} size={21} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: secondaryColors.white,
    borderColor: secondaryColors.tealPale,
    borderWidth: 3,
    justifyContent: 'center',
  },
  imageWrap: {
    alignItems: 'center',
    backgroundColor: secondaryColors.highlightSoft,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { color: secondaryColors.accent, fontWeight: '800' },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: secondaryColors.accent,
    borderColor: secondaryColors.white,
    borderRadius: 13,
    borderWidth: 2,
    bottom: -1,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: 26,
  },
}));
