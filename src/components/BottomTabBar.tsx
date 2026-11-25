import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { House, MessageCircle, Search, UserRound } from 'lucide-react-native';
import { secondaryColors as colors } from '../theme';
import { AccountRole } from '../types';

export type FamilyTabKey = 'care' | 'messages' | 'account';
export type CaregiverTabKey = 'notifications' | 'messages' | 'clients' | 'profile';
export type TabKey = 'explore' | FamilyTabKey | CaregiverTabKey;

type TabIcon = typeof House;

const familyTabs: { key: TabKey; label: string; icon: TabIcon }[] = [
  { key: 'explore', label: 'Inicio', icon: House },
  { key: 'care', label: 'Buscar', icon: Search },
  { key: 'messages', label: 'Mensajes', icon: MessageCircle },
  { key: 'account', label: 'Perfil', icon: UserRound },
];

const caregiverTabs: { key: TabKey; label: string; icon: TabIcon }[] = [
  { key: 'notifications', label: 'Inicio', icon: House },
  { key: 'clients', label: 'Buscar', icon: Search },
  { key: 'messages', label: 'Mensajes', icon: MessageCircle },
  { key: 'profile', label: 'Perfil', icon: UserRound },
];

const activeWidths: Record<string, number> = {
  Inicio: 88,
  Buscar: 91,
  Mensajes: 105,
  Perfil: 83,
};

type Props = {
  role?: AccountRole;
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
};

export function BottomTabBar({ role = 'family', activeTab, onSelectTab }: Props) {
  const tabs = role === 'caregiver' ? caregiverTabs : familyTabs;
  const barContentWidth = Math.max(0, useWindowDimensions().width - 40);
  const inactiveWidth = Math.min(48, barContentWidth / tabs.length);
  const activeWidthLimit = Math.max(inactiveWidth, barContentWidth - inactiveWidth * (tabs.length - 1));

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <TabButton
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            selected={selected}
            tab={{
              ...tab,
              activeWidth: Math.min(activeWidths[tab.label], activeWidthLimit),
              inactiveWidth,
            }}
          />
        );
      })}
    </View>
  );
}

type Tab = { key: TabKey; label: string; icon: TabIcon; activeWidth: number; inactiveWidth: number };

function TabButton({ onPress, selected, tab }: { onPress: () => void; selected: boolean; tab: Tab }) {
  const [width] = useState(() => new Animated.Value(selected ? tab.activeWidth : tab.inactiveWidth));
  const [labelOpacity] = useState(() => new Animated.Value(selected ? 1 : 0));
  const Icon = tab.icon;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(width, {
        toValue: selected ? tab.activeWidth : tab.inactiveWidth,
        damping: 19,
        stiffness: 210,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.timing(labelOpacity, {
        toValue: selected ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [labelOpacity, selected, tab.activeWidth, tab.inactiveWidth, width]);

  return (
    <Animated.View style={[styles.tabShell, { width }, selected && styles.activeTabShell]}>
      <Pressable
        accessibilityLabel={tab.label}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={styles.tab}
      >
        <Icon color={selected ? colors.white : colors.line} size={21} strokeWidth={2} />
        {selected && tab.activeWidth >= 82 && (
          <Animated.Text numberOfLines={1} style={[styles.label, { opacity: labelOpacity }]}>
            {tab.label}
          </Animated.Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderRadius: 32,
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    marginHorizontal: 12,
    padding: 8,
    shadowColor: colors.ink,
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  tabShell: { alignItems: 'center', borderRadius: 25, height: 48, justifyContent: 'center' },
  activeTabShell: { backgroundColor: colors.accent },
  tab: { alignItems: 'center', flexDirection: 'row', height: '100%', justifyContent: 'center', width: '100%' },
  label: { color: colors.white, fontSize: 11, fontWeight: '700', marginLeft: 6 },
});
