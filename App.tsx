import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { CaregiverProfileScreen } from './src/screens/CaregiverProfileScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { SimpleTabScreen } from './src/screens/SimpleTabScreen';
import { CaregiverOnboardingScreen } from './src/screens/CaregiverOnboardingScreen';
import { CaregiverWorkspaceScreen } from './src/screens/CaregiverWorkspaceScreen';
import { BottomTabBar, CaregiverTabKey, FamilyTabKey, TabKey } from './src/components/BottomTabBar';
import { createCuidador, getCuidadores, updateCuidadorDisponible, updateCuidadorUbicacion, updateUsuario } from './src/api/auth';
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

  const reporterApiId = signedInUser?.caregiverProfile?.apiId;
  const reporterToken = signedInUser?.token;
  const reporterAvailable = signedInUser?.role === 'caregiver'
    && signedInUser.caregiverProfile?.verificado === true
    && !!signedInUser.caregiverProfile?.disponible;
  const needsVerification = signedInUser?.role === 'caregiver'
    && !!signedInUser.caregiverProfile
    && signedInUser.caregiverProfile.verificado !== true;

  useEffect(() => {
    if (!needsVerification || !reporterApiId || !reporterToken) return;
    let active = true;
    const refreshVerification = async () => {
      try {
        const cuidadores = await getCuidadores(reporterToken);
        const found = cuidadores.find((c) => Number(c.id) === reporterApiId);
        if (active && found && Boolean(found.verificado)) {
          setSignedInUser((current) => current?.caregiverProfile
            ? { ...current, caregiverProfile: { ...current.caregiverProfile, verificado: true } }
            : current);
        }
      } catch {}
    };
    void refreshVerification();
    const interval = setInterval(() => { void refreshVerification(); }, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [needsVerification, reporterApiId, reporterToken]);

  useEffect(() => {
    if (!reporterAvailable || !reporterApiId || !reporterToken) return;
    let active = true;
    const reportLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        await updateCuidadorUbicacion(
          reporterApiId,
          {
            latitud: position.coords.latitude,
            longitud: position.coords.longitude,
            precision_metros: 10,
          },
          reporterToken,
        );
      } catch {}
    };
    void reportLocation();
    const interval = setInterval(() => { void reportLocation(); }, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reportLocation();
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [reporterAvailable, reporterApiId, reporterToken]);

  const openAuth = (mode: AuthMode) => setAuthMode(mode);

  const handleAuthComplete = (user: UserAccount) => {
    setAuthMode(null);
    if (user.role === 'caregiver') {
      if (user.caregiverProfile) {
        setSignedInUser(user);
        setActiveTab('notifications');
      } else {
        setCaregiverSetup(user);
      }
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

  const finishCaregiverProfile = async (user: UserAccount) => {
    try {
      if (user.id && user.caregiverProfile) {
        const existing = user.caregiverProfile;
        let apiId = existing.apiId;
        let verificado = existing.verificado ?? false;
        if (!apiId) {
          try {
            const cuidadores = await getCuidadores(user.token);
            const found = cuidadores.find((c) => Number(c.usuario_id) === user.id);
            if (found?.id) {
              apiId = Number(found.id);
              verificado = Boolean(found.verificado);
            }
          } catch {
            // si falla la consulta, intentamos crear
          }
        }
        if (!apiId) {
          const res = await createCuidador(
            {
              usuario_id: user.id,
              cedula: existing.identificationNumber.trim(),
              titulo: existing.professionalTitle.trim(),
              rfc: existing.rfc.trim().toUpperCase(),
              descripcion: existing.description.trim(),
              anios_experiencia: Number(existing.yearsExperience),
              tarifa_hora: Number(existing.hourlyRate),
              especialidades: existing.specialties.join(', '),
            },
            user.token,
          );
          apiId = res && typeof res === 'object' && 'id' in res ? Number((res as { id?: unknown }).id) : undefined;
          if (res && typeof res === 'object' && 'verificado' in res) {
            verificado = Boolean((res as { verificado?: unknown }).verificado);
          }
        }
        try {
          await updateUsuario(user.id, { rol: 'cuidador' }, user.token);
        } catch {
          // si el backend no permite cambiar rol, el perfil de cuidador ya fue creado
        }
        let disponibleActivo = verificado && (existing.disponible ?? false);
        if (apiId && verificado) {
          try {
            await updateCuidadorDisponible(apiId, true, user.token);
            disponibleActivo = true;
          } catch {}
        }
        if (apiId && existing.serviceCoordinates) {
          try {
            await updateCuidadorUbicacion(
              apiId,
              {
                latitud: existing.serviceCoordinates.latitude,
                longitud: existing.serviceCoordinates.longitude,
                precision_metros: 10,
              },
              user.token,
            );
          } catch {}
        }
        user = { ...user, role: 'caregiver', caregiverProfile: { ...existing, apiId, disponible: disponibleActivo, verificado } };
      }
      setSignedInUser(user);
      setCaregiverSetup(null);
      setActiveTab('notifications');
    } catch (e) {
      Alert.alert('No se pudo crear el perfil de cuidador', e instanceof Error ? e.message : 'Intenta de nuevo.');
      throw e;
    }
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
            onSaveLocation={async (serviceLocation, serviceCoordinates) => {
              const apiId = signedInUser.caregiverProfile?.apiId;
              if (apiId && serviceCoordinates) {
                await updateCuidadorUbicacion(apiId, {
                  latitud: serviceCoordinates.latitude,
                  longitud: serviceCoordinates.longitude,
                  precision_metros: 10,
                }, signedInUser.token);
              }
              setSignedInUser((current) => {
                if (current?.role !== 'caregiver' || !current.caregiverProfile) return current;
                return {
                  ...current,
                  caregiverProfile: { ...current.caregiverProfile, serviceLocation, serviceCoordinates },
                };
              });
            }}
            onUpdateUser={setSignedInUser}
            onSignOut={() => {
              setSignedInUser(null);
              setActiveTab('explore');
            }}
          />
        ) : activeTab === 'explore' ? (
          <ExploreScreen onSelectCaregiver={setSelectedCaregiver} token={signedInUser?.token} />
        ) : (
          <SimpleTabScreen
            tab={getFamilyTab(activeTab)}
            signedInUser={signedInUser}
            onSelectTab={setActiveTab}
            onSelectCaregiver={setSelectedCaregiver}
            onOpenAuth={openAuth}
            onSignOut={() => {
              setSignedInUser(null);
              setActiveTab('explore');
            }}
            onBecomeCaregiver={() => {
              if (!signedInUser) return;
              if (signedInUser.caregiverProfile) {
                setSignedInUser({ ...signedInUser, role: 'caregiver' });
                setActiveTab('notifications');
                return;
              }
              setCaregiverSetup(signedInUser);
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
