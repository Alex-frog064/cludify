import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CaregiverCard } from '../components/CaregiverCard';
import { ClientProfileSection } from '../components/ClientProfileSection';
import { caregivers } from '../data/caregivers';
import { FamilyTabKey, TabKey } from '../components/BottomTabBar';
import { colors } from '../theme';
import { CareRecipient, UserAccount } from '../types';

type Props = {
  tab: FamilyTabKey;
  signedInUser: UserAccount | null;
  onSelectTab: (tab: TabKey) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onSignOut: () => void;
  onSaveCareRecipient: (recipient: CareRecipient) => void;
  onDeleteCareRecipient: (recipientId: string) => void;
};

const copy: Record<FamilyTabKey, { title: string; subtitle: string; empty: string }> = {
  care: {
    title: 'Mis cuidados',
    subtitle: 'Aquí encontrarás tus solicitudes y servicios.',
    empty: 'Aún no tienes cuidados programados.',
  },
  messages: {
    title: 'Mensajes',
    subtitle: 'Conversa con cuidadores y coordina cada detalle.',
    empty: 'Tus conversaciones aparecerán aquí.',
  },
  account: {
    title: 'Mi cuenta',
    subtitle: 'Administra tu perfil y cuida de quienes más quieres.',
    empty: '',
  },
};

export function SimpleTabScreen({
  tab,
  signedInUser,
  onSelectTab,
  onOpenAuth,
  onSignOut,
  onSaveCareRecipient,
  onDeleteCareRecipient,
}: Props) {
  const content = copy[tab];
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.subtitle}>{content.subtitle}</Text>

      {tab === 'account' ? (
        signedInUser ? (
          <View style={styles.accountCard}>
            {signedInUser.profilePhotoUri ? (
              <Image source={{ uri: signedInUser.profilePhotoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{signedInUser.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.welcome}>Hola, {signedInUser.name}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{signedInUser.role === 'caregiver' ? 'Perfil de cuidador' : 'Cuenta familiar'}</Text>
            </View>
            <Text style={styles.accountContact}>{signedInUser.email}</Text>
            {!!signedInUser.phone && <Text style={styles.accountContact}>{signedInUser.phone}</Text>}
            {signedInUser.caregiverProfile ? (
              <>
                <Text style={styles.cardText}>
                  {signedInUser.caregiverProfile.professionalTitle} · {signedInUser.caregiverProfile.yearsExperience} años de experiencia
                </Text>
                <Text style={styles.profileDetails}>
                  ${signedInUser.caregiverProfile.hourlyRate} MXN/h · {signedInUser.caregiverProfile.availability.days.join(', ')}
                </Text>
              </>
            ) : signedInUser.role === 'family' ? (
              <>
                <Text style={styles.cardText}>Tu cuenta familiar está lista para organizar el cuidado.</Text>
                <ClientProfileSection
                  profiles={signedInUser.careRecipients ?? []}
                  onDelete={onDeleteCareRecipient}
                  onSave={onSaveCareRecipient}
                />
              </>
            ) : (
              <Text style={styles.cardText}>Tu sesión es solo de demostración y no está conectada a un servicio.</Text>
            )}
            <Pressable onPress={onSignOut} style={styles.outlineButton}>
              <Text style={styles.outlineText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.accountCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>♡</Text></View>
            <Text style={styles.welcome}>Cuidado con confianza</Text>
            <Text style={styles.cardText}>Inicia sesión o crea una cuenta para organizar el cuidado de tu familia.</Text>
            <Pressable onPress={() => onOpenAuth('login')} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Iniciar sesión</Text>
            </Pressable>
            <Pressable onPress={() => onOpenAuth('signup')} style={styles.outlineButton}>
              <Text style={styles.outlineText}>Crear cuenta</Text>
            </Pressable>
          </View>
        )
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>{tab === 'care' ? '▣' : '○'}</Text>
          <Text style={styles.emptyTitle}>{content.empty}</Text>
          <Text style={styles.cardText}>
            {tab === 'care'
              ? 'Cuando solicites un servicio, podrás consultar aquí los detalles.'
              : 'Cuando contactes a un cuidador, la conversación estará aquí.'}
          </Text>
          <Pressable onPress={() => onSelectTab('explore')} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Explorar cuidadores</Text>
          </Pressable>
        </View>
      )}

      {tab === 'care' && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionTitle}>Cuidadores cerca de ti</Text>
          <CaregiverCard caregiver={caregivers[0]} onPress={() => onSelectTab('explore')} compact />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flexGrow: 1, paddingHorizontal: 19, paddingTop: 30, paddingBottom: 26 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  accountCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, marginTop: 25, padding: 22 },
  avatar: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 31, height: 62, justifyContent: 'center', width: 62 },
  avatarText: { color: colors.tealDark, fontSize: 27, fontWeight: '700' },
  welcome: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 13, textAlign: 'center' },
  roleBadge: { backgroundColor: colors.tealPale, borderRadius: 12, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText: { color: colors.tealDark, fontSize: 10, fontWeight: '700' },
  accountContact: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: 'center' },
  cardText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  profileDetails: { color: colors.tealDark, fontSize: 11, fontWeight: '700', marginTop: 8 },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.teal, borderRadius: 13, marginTop: 18, paddingVertical: 13 },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  outlineButton: { alignItems: 'center', alignSelf: 'stretch', borderColor: colors.line, borderRadius: 13, borderWidth: 1, marginTop: 10, paddingVertical: 12 },
  outlineText: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, marginTop: 25, padding: 22 },
  emptyIcon: { color: colors.teal, fontSize: 31 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  suggestions: { marginTop: 23 },
  suggestionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 10 },
});
