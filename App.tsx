import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { ClientProfileScreen } from './src/screens/ClientProfileScreen';
import { CaregiverProfileScreen } from './src/screens/CaregiverProfileScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { SimpleTabScreen } from './src/screens/SimpleTabScreen';
import { CaregiverOnboardingScreen } from './src/screens/CaregiverOnboardingScreen';
import { ServiceRequestScreen } from './src/screens/ServiceRequestScreen';
import { CaregiverWorkspaceScreen } from './src/screens/CaregiverWorkspaceScreen';
import { BottomTabBar, CaregiverTabKey, FamilyTabKey, TabKey } from './src/components/BottomTabBar';
import { createCuidador, createUbicacionTiempoReal, getAbuelos, getCuidadores, getServicios, iniciarConsulta, updateCuidadorDisponible, updateCuidadorUbicacion, updateUsuario } from './src/api/auth';
import { Caregiver, Servicio, UserAccount } from './src/types';
import { colors } from './src/theme';

type AuthMode = 'login' | 'signup';

const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

type SelectedPatient = {
  abueloId: number;
  familiarNombre?: string;
  consultaId?: number;
};

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
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [serviceRequestCaregiver, setServiceRequestCaregiver] = useState<Caregiver | null>(null);
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null);
  const [servicioRefreshKey, setServicioRefreshKey] = useState(0);
  const [activeConsultaId, setActiveConsultaId] = useState<number | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [signedInUser, setSignedInUser] = useState<UserAccount | null>(null);
  const [caregiverSetup, setCaregiverSetup] = useState<UserAccount | null>(null);
  const [availabilityActivatedAt, setAvailabilityActivatedAt] = useState<number | null>(null);

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
        const coords = {
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          precision_metros: 10,
        };
        try {
          await updateCuidadorUbicacion(reporterApiId, coords, reporterToken);
        } catch (e) {
          const message = e instanceof Error ? e.message : '';
          if (!/servicio activo/i.test(message)) return;
          const servicios = await getServicios(reporterToken);
          const activeService = servicios.find(
            (item) => Number(item.cuidador_id) === reporterApiId && String(item.estado) === 'activo',
          );
          const abueloId = activeService ? Number(activeService.abuelo_id) : NaN;
          if (!Number.isFinite(abueloId)) return;
          await createUbicacionTiempoReal(
            { ...coords, cuidador_id: reporterApiId, abuelo_id: abueloId },
            reporterToken,
          );
        }
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

  useEffect(() => {
    if (!reporterAvailable || !availabilityActivatedAt || !reporterApiId || !reporterToken) return;
    const deactivate = async () => {
      try { await updateCuidadorDisponible(reporterApiId, false, reporterToken); } catch {}
      setSignedInUser((current) => current?.caregiverProfile
        ? { ...current, caregiverProfile: { ...current.caregiverProfile, disponible: false } }
        : current);
      setAvailabilityActivatedAt(null);
      Alert.alert('Disponibilidad finalizada', 'Pasaron 30 minutos y tu perfil se desactivó automáticamente.');
    };
    const remaining = ACTIVE_WINDOW_MS - (Date.now() - availabilityActivatedAt);
    if (remaining <= 0) {
      void deactivate();
      return;
    }
    const timeout = setTimeout(() => { void deactivate(); }, remaining);
    return () => clearTimeout(timeout);
  }, [reporterAvailable, availabilityActivatedAt, reporterApiId, reporterToken]);

  const openAuth = (mode: AuthMode) => setAuthMode(mode);

  const handleAuthComplete = (user: UserAccount) => {
    setAuthMode(null);
    if (user.role === 'caregiver') {
      if (user.caregiverProfile) {
        setSignedInUser(user);
        setAvailabilityActivatedAt(user.caregiverProfile.disponible ? Date.now() : null);
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
    if (signedInUser.role !== 'family') {
      Alert.alert('Solo familiares', 'Los cuidadores no pueden solicitar sus propios servicios.');
      return;
    }
    if (!selectedCaregiver) return;
    setServiceRequestCaregiver(selectedCaregiver);
  };

  const handleContactCaregiver = async () => {
    if (!selectedCaregiver) return;
    if (!signedInUser) {
      openAuth('login');
      return;
    }
    if (signedInUser.role !== 'family') {
      Alert.alert('Solo familiares', 'Los cuidadores pueden ver el historial, pero no iniciar conversaciones.');
      return;
    }

    const cuidadorId = Number(selectedCaregiver.id);
    if (!Number.isFinite(cuidadorId)) {
      Alert.alert('No se pudo iniciar el chat', 'Este cuidador no tiene un identificador válido.');
      return;
    }

    setChatLoading(true);
    try {
      const consulta = await iniciarConsulta(cuidadorId, signedInUser.token);
      setActiveConsultaId(Number(consulta.consulta_id));
      setSelectedCaregiver(null);
      setActiveTab('messages');
    } catch (e) {
      Alert.alert('No se pudo iniciar el chat', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setChatLoading(false);
    }
  };

  const openPatientProfile = (abueloId: number, familiarNombre?: string, consultaId?: number) => {
    setSelectedPatient({ abueloId, familiarNombre, consultaId });
  };

  const handleOpenClientProfile = async (familiarId: number, familiarNombre: string, consultaId: number) => {
    if (!signedInUser?.token) return;
    try {
      const abuelos = await getAbuelos(signedInUser.token);
      const found = abuelos.find((item) => Number(item.familiar_id) === familiarId);
      if (!found || !found.id) {
        Alert.alert('Sin paciente registrado', 'Esta familia todavía no tiene un paciente en su perfil.');
        return;
      }
      openPatientProfile(Number(found.id), familiarNombre, consultaId);
    } catch (e) {
      Alert.alert('No se pudo abrir el perfil', e instanceof Error ? e.message : 'Intenta de nuevo.');
    }
  };

  const handleOpenConsulta = (consultaId: number) => {
    setActiveConsultaId(consultaId);
    setSelectedPatient(null);
    setActiveTab('messages');
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
      setAvailabilityActivatedAt(user.caregiverProfile?.disponible ? Date.now() : null);
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

  if (selectedPatient) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.canvas, flex: 1 }}>
          <StatusBar style="dark" />
          <ClientProfileScreen
            abueloId={selectedPatient.abueloId}
            familiarNombre={selectedPatient.familiarNombre}
            consultaId={selectedPatient.consultaId}
            token={signedInUser?.token}
            onBack={() => setSelectedPatient(null)}
            onOpenChat={() => {
              if (selectedPatient.consultaId) handleOpenConsulta(selectedPatient.consultaId);
              else setSelectedPatient(null);
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (editingServicio) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.canvas, flex: 1 }}>
          <StatusBar style="dark" />
          <ServiceRequestScreen
            servicio={editingServicio}
            token={signedInUser?.token ?? ''}
            onBack={() => setEditingServicio(null)}
            onCreated={() => {
              setEditingServicio(null);
              setServicioRefreshKey((key) => key + 1);
              setActiveTab('care');
              Alert.alert('Servicio actualizado', 'Los cambios ya están disponibles en Mis cuidados.');
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (serviceRequestCaregiver) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.canvas, flex: 1 }}>
          <StatusBar style="dark" />
          <ServiceRequestScreen
            caregiver={serviceRequestCaregiver}
            token={signedInUser?.token ?? ''}
            onBack={() => setServiceRequestCaregiver(null)}
            onCreated={() => {
              setServiceRequestCaregiver(null);
              setSelectedCaregiver(null);
              setServicioRefreshKey((key) => key + 1);
              setActiveTab('care');
              Alert.alert('Solicitud enviada', 'El cuidador verá el servicio en su apartado de Servicios.');
            }}
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
            onMessage={handleContactCaregiver}
            messageLoading={chatLoading}
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
            onOpenConsulta={handleOpenConsulta}
            onOpenPaciente={openPatientProfile}
            onOpenClient={handleOpenClientProfile}
            activeUntil={availabilityActivatedAt ? availabilityActivatedAt + ACTIVE_WINDOW_MS : null}
            onAvailabilityChange={(disponible) => setAvailabilityActivatedAt(disponible ? Date.now() : null)}
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
            onEditServicio={setEditingServicio}
            servicioRefreshKey={servicioRefreshKey}
            activeConsultaId={activeConsultaId}
            onActiveConsultaChange={setActiveConsultaId}
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
