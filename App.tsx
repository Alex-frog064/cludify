import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { CaregiverProfileScreen } from './src/screens/CaregiverProfileScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { SimpleTabScreen } from './src/screens/SimpleTabScreen';
import { CaregiverOnboardingScreen } from './src/screens/CaregiverOnboardingScreen';
import { CaregiverWorkspaceScreen } from './src/screens/CaregiverWorkspaceScreen';
import { BottomTabBar, CaregiverTabKey, FamilyTabKey, TabKey } from './src/components/BottomTabBar';
import { Caregiver, UserAccount } from './src/types';
import { colors } from './src/theme';

type AuthMode = 'login' | 'signup';

function getCaregiverTab(tab: TabKey): CaregiverTabKey {
  return tab === 'messages' || tab === 'clients' || tab === 'profile' || tab === 'notifications'
    ? tab
    : 'notifications';
}

function getFamilyTab(tab: TabKey): FamilyTabKey {
  return tab === 'care' || tab === 'messages' || tab === 'account' ? tab : 'account';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('explore');
  const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [signedInUser, setSignedInUser] = useState<UserAccount | null>(null);
  const [caregiverSetup, setCaregiverSetup] = useState<UserAccount | null>(null);

  const openAuth = (mode: AuthMode) => setAuthMode(mode);

  const handleAuthComplete = (user: UserAccount) => {
    setAuthMode(null);
    if (user.role === 'caregiver') {
      setCaregiverSetup(user);
      return;
    }
    setSignedInUser(user);
    setActiveTab('account');
  };

  const handleRequestCare = () => {
    if (!signedInUser) {
      openAuth('login');
      return;
    }

    Alert.alert(
      'Solicitud de demostración',
      'La solicitud se mostraría aquí. Esta versión todavía no está conectada a un servicio.',
    );
  };

  const finishCaregiverProfile = (user: UserAccount) => {
    setSignedInUser(user);
    setCaregiverSetup(null);
    setActiveTab('notifications');
  };

  if (caregiverSetup) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.canvas, flex: 1 }}>
          <StatusBar style="dark" />
          <CaregiverOnboardingScreen
            account={caregiverSetup}
            onCancel={() => {
              setCaregiverSetup(null);
              setActiveTab('account');
            }}
            onComplete={finishCaregiverProfile}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (authMode) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.canvas, flex: 1 }}>
          <StatusBar style="dark" />
          <AuthScreen
            mode={authMode}
            onBack={() => setAuthMode(null)}
            onChangeMode={setAuthMode}
            onComplete={handleAuthComplete}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (selectedCaregiver) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.canvas, flex: 1 }}>
          <StatusBar style="dark" />
          <CaregiverProfileScreen
            caregiver={selectedCaregiver}
            onBack={() => setSelectedCaregiver(null)}
            onRequestCare={handleRequestCare}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.canvas, flex: 1 }}>
        <StatusBar style="dark" />
        {signedInUser?.role === 'caregiver' ? (
          <CaregiverWorkspaceScreen
            tab={getCaregiverTab(activeTab)}
            user={signedInUser}
            onSelectTab={setActiveTab}
            onSaveLocation={(serviceLocation, serviceCoordinates) => {
              setSignedInUser((current) => {
                if (current?.role !== 'caregiver' || !current.caregiverProfile) return current;
                return {
                  ...current,
                  caregiverProfile: { ...current.caregiverProfile, serviceLocation, serviceCoordinates },
                };
              });
            }}
            onSignOut={() => {
              setSignedInUser(null);
              setActiveTab('explore');
            }}
          />
        ) : activeTab === 'explore' ? (
          <ExploreScreen onSelectCaregiver={setSelectedCaregiver} />
        ) : (
          <SimpleTabScreen
            tab={getFamilyTab(activeTab)}
            signedInUser={signedInUser}
            onSelectTab={setActiveTab}
            onOpenAuth={openAuth}
            onSignOut={() => {
              setSignedInUser(null);
              setActiveTab('explore');
            }}
            onSaveCareRecipient={(recipient) => {
              setSignedInUser((current) => {
                if (!current || current.role !== 'family') return current;
                const careRecipients = current.careRecipients ?? [];
                const exists = careRecipients.some((item) => item.id === recipient.id);
                return {
                  ...current,
                  careRecipients: exists
                    ? careRecipients.map((item) => (item.id === recipient.id ? recipient : item))
                    : [...careRecipients, recipient],
                };
              });
            }}
            onDeleteCareRecipient={(recipientId) => {
              setSignedInUser((current) => {
                if (!current || current.role !== 'family') return current;
                return {
                  ...current,
                  careRecipients: (current.careRecipients ?? []).filter((item) => item.id !== recipientId),
                };
              });
            }}
          />
        )}
        <BottomTabBar role={signedInUser?.role} activeTab={activeTab} onSelectTab={setActiveTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
