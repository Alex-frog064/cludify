import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <View style={[styles.icon, destructive && styles.destructiveIcon]}>
            <Text style={[styles.iconText, destructive && styles.destructiveIconText]}>
              {destructive ? '!' : '?'}
            </Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onConfirm}
              style={[styles.confirmButton, destructive && styles.destructiveButton, loading && styles.disabledButton]}
            >
              <Text style={styles.confirmText}>{loading ? 'Procesando...' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(17, 39, 41, 0.56)', flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 24, maxWidth: 420, padding: 26, width: '100%' },
  icon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 30, height: 60, justifyContent: 'center', width: 60 },
  iconText: { color: colors.tealDark, fontSize: 26, fontWeight: '800' },
  destructiveIcon: { backgroundColor: '#FCECEB' },
  destructiveIconText: { color: '#B64B47' },
  title: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  message: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 9, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24, width: '100%' },
  cancelButton: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: 13, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  cancelText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  confirmButton: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 13, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  destructiveButton: { backgroundColor: '#B64B47' },
  disabledButton: { opacity: 0.65 },
  confirmText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
