import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { AccountRole } from '../types';

export type FamilyTabKey = 'care' | 'messages' | 'account';
export type CaregiverTabKey = 'notifications' | 'messages' | 'clients' | 'profile';
export type TabKey = 'explore' | FamilyTabKey | CaregiverTabKey;

type IconName = keyof typeof Ionicons.glyphMap;

const familyTabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'explore', label: 'Explorar', icon: 'search-outline' },
  { key: 'care', label: 'Mis cuidados', icon: 'calendar-outline' },
  { key: 'messages', label: 'Mensajes', icon: 'chatbubble-ellipses-outline' },
  { key: 'account', label: 'Mi cuenta', icon: 'person-outline' },
];

const caregiverTabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'notifications', label: 'Avisos', icon: 'notifications-outline' },
  { key: 'messages', label: 'Mensajes', icon: 'chatbubble-ellipses-outline' },
  { key: 'clients', label: 'Servicios', icon: 'briefcase-outline' },
  { key: 'profile', label: 'Perfil', icon: 'person-outline' },
];

type Props = {
  role?: AccountRole;
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
};

export function BottomTabBar({ role = 'family', activeTab, onSelectTab }: Props) {
  const tabs = role === 'caregiver' ? caregiverTabs : familyTabs;
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={styles.tab}
          >
            <View style={[styles.iconWrap, selected && styles.selectedIconWrap]}>
              <Ionicons color={selected ? colors.tealDark : '#91A3A6'} name={tab.icon} size={20} />
            </View>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 6,
    paddingTop: 7,
  },
  tab: { alignItems: 'center', flex: 1 },
  iconWrap: { alignItems: 'center', borderRadius: 13, height: 28, justifyContent: 'center', width: 42 },
  selectedIconWrap: { backgroundColor: colors.tealPale },
  label: { color: '#87979A', fontSize: 9, marginTop: 3 },
  selectedLabel: { color: colors.tealDark, fontWeight: '700' },
});
