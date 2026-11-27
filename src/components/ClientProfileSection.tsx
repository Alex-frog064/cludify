import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from './LocalizedText';
import { Plus, UserRoundPlus } from 'lucide-react-native';
import {
  createAbuelo,
  createGeocerca,
  createMedicina,
  deleteAbuelo,
  deleteGeocerca,
  deleteMedicina,
  getAbuelos,
  getGeocercas,
  getMedicinas,
  updateAbuelo,
  updateGeocerca,
  updateMedicina,
} from '../api/auth';
import { ConfirmationModal } from './ConfirmationModal';
import { OpenStreetMapView } from './OpenStreetMapView';
import { getCurrentServiceLocation, searchAddressSuggestions, AddressSuggestion } from '../utils/currentServiceLocation';
import { secondaryColors as colors , createThemedStyles} from '../theme';
import { CareRecipient, Geofence, Medication } from '../types';

type Props = {
  profiles: CareRecipient[];
  familiarId?: number;
  token?: string;
  onSave: (recipient: CareRecipient) => void | Promise<void>;
  onDelete: (recipientId: string) => void | Promise<void>;
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createRecipient = (): CareRecipient => ({
  id: createId(),
  name: '',
  birthDate: '',
  conditions: '',
  notes: '',
  medications: [],
  geofence: { nombre: 'Casa', latitud: 0, longitud: 0, radio_metros: 100, activo: true },
});

type PendingConfirmation =
  | { type: 'deleteProfile'; profile: CareRecipient }
  | { type: 'removeMedication'; medicationId: string }
  | { type: 'discardRecipient' }
  | { type: 'discardMedication' }
  | { type: 'discardLocation' };

export function ClientProfileSection({ profiles, familiarId, token, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<CareRecipient | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoSuggestions, setGeoSuggestions] = useState<AddressSuggestion[]>([]);
  const [geoModalOpen, setGeoModalOpen] = useState(false);
  const [geofenceBeforeEdit, setGeofenceBeforeEdit] = useState<Geofence | undefined>();
  const [medModal, setMedModal] = useState<Medication | null>(null);
  const loadedKeyRef = useRef<string>('');
  const profilesRef = useRef(profiles);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!familiarId) return;
      const key = `${familiarId}:${token ?? ''}`;
      if (loadedKeyRef.current === key) return;
      loadedKeyRef.current = key;
      setLoadingProfiles(true);
      try {
        const data = await getAbuelos(token);
        if (cancelled) return;
        const mine = data.filter((item) => Number(item.familiar_id) === familiarId);
        let meds: Record<string, unknown>[] = [];
        let geocercas: Record<string, unknown>[] = [];
        try { meds = await getMedicinas(token); } catch { meds = []; }
        try { geocercas = await getGeocercas(token); } catch { geocercas = []; }
        for (const item of mine) {
          const apiId = typeof item.id === 'number' ? item.id : undefined;
          if (!apiId) continue;
          const existing = profilesRef.current.find((p) => p.apiId === apiId);
          const medications = meds
            .filter((m) => Number(m.abuelo_id) === apiId)
            .map((m) => {
              const mid = typeof m.id === 'number' ? m.id : undefined;
              const prev = existing?.medications.find((x) => x.apiId === mid);
              return {
                id: prev?.id ?? (mid ? `med-${mid}` : createId()),
                apiId: mid,
                name: String(m.nombre ?? ''),
                dosage: String(m.dosis ?? ''),
                schedule: String(m.horario ?? ''),
              } as Medication;
            });
          const g = geocercas.find((x) => Number(x.abuelo_id) === apiId);
          const geofence: Geofence | undefined = g
            ? {
                id: typeof g.id === 'number' ? g.id : undefined,
                abuelo_id: apiId,
                nombre: String(g.nombre ?? 'Casa'),
                latitud: Number(g.latitud),
                longitud: Number(g.longitud),
                radio_metros: Number(g.radio_metros ?? 100),
                activo: Boolean(g.activo ?? true),
                calle: existing?.geofence?.calle,
                colonia: existing?.geofence?.colonia,
                codigoPostal: existing?.geofence?.codigoPostal,
                ciudad: existing?.geofence?.ciudad,
                estado: existing?.geofence?.estado,
              }
            : existing?.geofence;
          await onSave({
            id: existing?.id ?? `api-${apiId}`,
            apiId,
            name: String(item.nombre ?? ''),
            birthDate: isoToDisplayBirthDate(String(item.nacimiento ?? '')),
            conditions: String(item.condiciones ?? ''),
            notes: String(item.notas ?? ''),
            medications,
            geofence,
          });
        }
      } catch (e) {
        if (!cancelled) {
          loadedKeyRef.current = '';
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los perfiles.');
        }
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [familiarId, onSave, token]);

  const updateDraft = (updates: Partial<CareRecipient>) => {
    setDraft((current) => (current ? { ...current, ...updates } : current));
    setError('');
  };

  const updateGeofence = (updates: Partial<Geofence>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            geofence: {
              nombre: 'Casa',
              latitud: 0,
              longitud: 0,
              radio_metros: 100,
              activo: true,
              ...(current.geofence ?? {}),
              ...updates,
            },
          }
        : current,
    );
    setError('');
  };

  const locateGeofence = async () => {
    if (!draft) return;
    setGeoLoading(true);
    setError('');
    setGeoSuggestions([]);
    try {
      const suggestions = await searchAddressSuggestions({
        calle: draft.geofence?.calle,
        colonia: draft.geofence?.colonia,
        codigoPostal: draft.geofence?.codigoPostal,
        ciudad: draft.geofence?.ciudad,
        estado: draft.geofence?.estado,
      });
      if (!suggestions.length) {
        setError('No se encontraron coincidencias. Amplía colonia o ciudad, o usa tu ubicación actual.');
        return;
      }
      setGeoSuggestions(suggestions);
      const first = suggestions[0];
      updateGeofence({
        latitud: first.coordinates.latitude,
        longitud: first.coordinates.longitude,
        calle: first.calle ?? draft.geofence?.calle,
        colonia: first.colonia ?? draft.geofence?.colonia,
        codigoPostal: first.codigoPostal ?? draft.geofence?.codigoPostal,
        ciudad: first.ciudad ?? draft.geofence?.ciudad,
        estado: first.estado ?? draft.geofence?.estado,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar la dirección.');
    } finally {
      setGeoLoading(false);
    }
  };

  const useCurrentGeofenceLocation = async () => {
    setGeoLocating(true);
    setError('');
    try {
      const result = await getCurrentServiceLocation();
      if (!result.granted) {
        setError('Permite el acceso a tu ubicación para usar la ubicación actual.');
        return;
      }
      updateGeofence({
        latitud: result.coordinates.latitude,
        longitud: result.coordinates.longitude,
        ciudad: draft?.geofence?.ciudad,
        estado: draft?.geofence?.estado,
      });
      setGeoSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener la ubicación actual.');
    } finally {
      setGeoLocating(false);
    }
  };

  const updateBirthDate = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const birthDate =
      digits.length > 4
        ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
        : digits.length > 2
          ? `${digits.slice(0, 2)}/${digits.slice(2)}`
          : digits;
    updateDraft({ birthDate });
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError('Escribe el nombre de la persona que recibirá cuidados.');
      return;
    }
    if (!isValidBirthDate(draft.birthDate)) {
      setError('Escribe una fecha de nacimiento válida en formato DD/MM/AAAA.');
      return;
    }
    const medications = draft.medications
      .map((medication) => ({
        ...medication,
        name: medication.name.trim(),
        dosage: medication.dosage.trim(),
        schedule: medication.schedule.trim(),
      }))
      .filter((medication) => medication.name || medication.dosage || medication.schedule);
    if (medications.some((medication) => !medication.name || !medication.dosage || !medication.schedule)) {
      setError('Completa nombre, dosis y horario de cada medicamento.');
      return;
    }

    const recipient: CareRecipient = {
      ...draft,
      name: draft.name.trim(),
      conditions: draft.conditions.trim(),
      notes: draft.notes.trim(),
      medications,
    };

    setError('');
    setLoading(true);
    try {
      const payload = {
        familiar_id: familiarId ?? 0,
        nombre: recipient.name,
        nacimiento: toIsoBirthDate(recipient.birthDate),
        condiciones: recipient.conditions,
        notas: recipient.notes,
      };

      let abueloId = recipient.apiId;
      if (abueloId) {
        await updateAbuelo(abueloId, payload, token);
      } else if (familiarId) {
        const data = await createAbuelo(payload, token);
        abueloId = typeof data.id === 'number' ? data.id : recipient.apiId;
      }

      const savedMedications: Medication[] = [];
      if (abueloId) {
        const original = profilesRef.current.find((p) => p.id === recipient.id)?.medications ?? [];
        for (const med of original) {
          if (med.apiId && !medications.some((m) => m.apiId === med.apiId)) {
            await deleteMedicina(med.apiId, token);
          }
        }
        for (const med of medications) {
          const medPayload = { abuelo_id: abueloId, nombre: med.name, dosis: med.dosage, horario: med.schedule };
          if (med.apiId) {
            await updateMedicina(med.apiId, medPayload, token);
            savedMedications.push(med);
          } else {
            const data = await createMedicina(medPayload, token);
            savedMedications.push({ ...med, apiId: typeof data.id === 'number' ? data.id : undefined });
          }
        }
      }

      let savedGeofence = recipient.geofence;
      const originalGeofence = profilesRef.current.find((p) => p.id === recipient.id)?.geofence;
      if (abueloId) {
        const hasCoords = !!recipient.geofence?.latitud && !!recipient.geofence?.longitud;
        const geoPayload = {
          abuelo_id: abueloId,
          nombre: recipient.geofence?.nombre || `Casa de ${recipient.name}`,
          latitud: Number(recipient.geofence?.latitud ?? 0),
          longitud: Number(recipient.geofence?.longitud ?? 0),
          radio_metros: Number(recipient.geofence?.radio_metros || 100),
          activo: recipient.geofence?.activo ?? true,
        };

        if (hasCoords) {
          if (recipient.geofence?.id) {
            const data = await updateGeocerca(recipient.geofence.id, geoPayload, token);
            savedGeofence = { ...recipient.geofence, ...geoPayload, id: typeof data.id === 'number' ? data.id : recipient.geofence.id };
          } else {
            const data = await createGeocerca(geoPayload, token);
            savedGeofence = { ...(recipient.geofence ?? geoPayload), ...geoPayload, id: typeof data.id === 'number' ? data.id : undefined };
          }
        } else if (originalGeofence?.id) {
          await deleteGeocerca(originalGeofence.id, token);
          savedGeofence = undefined;
        }
      }

      await onSave({ ...recipient, apiId: abueloId, medications: abueloId ? savedMedications : medications, geofence: savedGeofence });
      setGeoSuggestions([]);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) return;
    if (pendingConfirmation.type === 'deleteProfile') {
      const { profile } = pendingConfirmation;
      setError('');
      setLoading(true);
      try {
        if (profile.apiId) await deleteAbuelo(profile.apiId, token);
        await onDelete(profile.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo eliminar el perfil.');
      } finally {
        setLoading(false);
        setPendingConfirmation(null);
      }
      return;
    }

    if (pendingConfirmation.type === 'removeMedication') {
      if (draft) {
        updateDraft({ medications: draft.medications.filter((item) => item.id !== pendingConfirmation.medicationId) });
      }
    } else if (pendingConfirmation.type === 'discardRecipient') {
      setDraft(null);
      setError('');
    } else if (pendingConfirmation.type === 'discardMedication') {
      setMedModal(null);
      setError('');
    } else {
      setDraft((current) => current
        ? { ...current, geofence: geofenceBeforeEdit ? { ...geofenceBeforeEdit } : undefined }
        : current);
      setGeoModalOpen(false);
      setGeoSuggestions([]);
      setGeofenceBeforeEdit(undefined);
      setError('');
    }
    setPendingConfirmation(null);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Mis personas mayores</Text>
          <Text style={styles.sectionHint}>Datos de salud, ubicación y medicamentos.</Text>
        </View>
        {!draft && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraft(createRecipient());
              setError('');
            }}
            style={styles.addButton}
          >
            <UserRoundPlus color={colors.white} size={20} strokeWidth={2} />
            <Text style={styles.addButtonText}>Agregar persona</Text>
          </Pressable>
        )}
      </View>

      {!!error && !draft && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

      {loadingProfiles ? (
        <View style={styles.emptyCard}><ActivityIndicator color={colors.tealDark} /></View>
      ) : profiles.length === 0 && !draft ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><UserRoundPlus color={colors.accent} size={22} strokeWidth={2} /></View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Aún no agregas a nadie</Text>
            <Text style={styles.emptyText}>Registra a tu familiar para personalizar su cuidado.</Text>
          </View>
        </View>
      ) : (
        profiles.map((profile) => (
          <View key={profile.id} style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileIdentity}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileBirthDate}>Nacimiento · {profile.birthDate}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setDraft({
                    ...profile,
                    geofence: profile.geofence ? { ...profile.geofence } : undefined,
                    medications: profile.medications.map((medication) => ({ ...medication })),
                  });
                  setError('');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Editar</Text>
              </Pressable>
            </View>
            {!!profile.conditions && <ProfileDetail label="Condiciones" value={profile.conditions} />}
            {!!profile.notes && <ProfileDetail label="Notas" value={profile.notes} />}
            {profile.geofence?.latitud && profile.geofence?.longitud ? (
              <ProfileDetail
                label="Ubicación"
                value={`${profile.geofence.nombre}: ${profile.geofence.latitud.toFixed(5)}, ${profile.geofence.longitud.toFixed(5)}`}
              />
            ) : null}
            <Text style={styles.medicationHeading}>
              Medicamentos{profile.medications.length ? ` • ${profile.medications.length}` : ''}
            </Text>
            {profile.medications.length ? (
              profile.medications.map((medication) => (
                <View key={medication.id} style={styles.medicationSummary}>
                  <Text style={styles.medicationName}>{medication.name}</Text>
                  <Text style={styles.medicationDescription}>
                    {medication.dosage} · {medication.schedule}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noMedication}>Sin medicamentos registrados.</Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setPendingConfirmation({ type: 'deleteProfile', profile })}
              style={styles.removeLink}
            >
              <Text style={styles.removeLinkText}>Eliminar perfil</Text>
            </Pressable>
          </View>
        ))
      )}

      <Modal visible={!!draft} animationType="fade" transparent onRequestClose={() => setPendingConfirmation({ type: 'discardRecipient' })}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={styles.modalKeyboardAvoiding}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {draft && (<>
          <Text style={styles.formTitle}>{profiles.some((profile) => profile.id === draft.id) ? 'Editar datos' : 'Nueva persona a cuidar'}</Text>
          <FormInput
            label="Nombre completo"
            value={draft.name}
            onChangeText={(name) => updateDraft({ name })}
            placeholder="Nombre de la persona"
          />
          <FormInput
            label="Fecha de nacimiento"
            value={draft.birthDate}
            onChangeText={updateBirthDate}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
          />
          <FormInput
            label="Condiciones de salud"
            value={draft.conditions}
            onChangeText={(conditions) => updateDraft({ conditions })}
            placeholder="Ej. movilidad reducida, diabetes"
            multiline
          />
          <FormInput
            label="Notas importantes"
            value={draft.notes}
            onChangeText={(notes) => updateDraft({ notes })}
            placeholder="Alergias, preferencias u otra información"
            multiline
          />

          <View style={styles.medicationFormHeader}>
            <View>
              <Text style={styles.formLabel}>Ubicación</Text>
              <Text style={styles.sectionHint}>{draft.geofence?.latitud && draft.geofence?.longitud ? (draft.geofence.calle || draft.geofence.nombre || 'Ubicación guardada') : 'Sin ubicación'}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => {
              setGeofenceBeforeEdit(draft.geofence ? { ...draft.geofence } : undefined);
              setGeoModalOpen(true);
            }} style={styles.addMedicationButton}>
              <Text style={styles.addMedicationText}>{draft.geofence?.latitud ? 'Editar' : 'Agregar'}</Text>
            </Pressable>
          </View>

          <View style={styles.medicationFormHeader}>
            <View>
              <Text style={styles.formLabel}>Medicamentos</Text>
              <Text style={styles.sectionHint}>{draft.medications.length ? `${draft.medications.length} registrado(s)` : 'Opcional'}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setMedModal({ id: createId(), name: '', dosage: '', schedule: '' })} style={styles.addMedicationButton}>
              <Plus color={colors.accent} size={20} strokeWidth={2} />
              <Text style={styles.addMedicationText}>Agregar</Text>
            </Pressable>
          </View>
          {draft.medications.map((medication) => (
            <View key={medication.id} style={styles.medicationSummaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medicationName}>{medication.name}</Text>
                <Text style={styles.medicationDescription}>{medication.dosage} • {medication.schedule}</Text>
              </View>
              <Pressable onPress={() => setMedModal({ ...medication })} style={styles.textButton}><Text style={styles.textButtonLabel}>Editar</Text></Pressable>
              <Pressable onPress={() => setPendingConfirmation({ type: 'removeMedication', medicationId: medication.id })} style={styles.textButton}><Text style={styles.removeLinkText}>Quitar</Text></Pressable>
            </View>
          ))}

          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={loading} onPress={saveDraft} style={[styles.saveButton, loading && styles.saveButtonDisabled]}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Guardar datos</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={loading} onPress={() => setPendingConfirmation({ type: 'discardRecipient' })} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
              </>)}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={geoModalOpen && !!draft} animationType="fade" transparent onRequestClose={() => setPendingConfirmation({ type: 'discardLocation' })}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={styles.modalKeyboardAvoiding}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.formTitle}>Ubicación</Text>
              <Text style={styles.sectionHint}>Captura dirección por partes para obtener coordenadas más exactas.</Text>
              <FormInput label="Calle y número" value={draft?.geofence?.calle ?? ''} onChangeText={(calle) => updateGeofence({ calle })} placeholder="Ej. Calle 60 123" />
              <FormInput label="Colonia" value={draft?.geofence?.colonia ?? ''} onChangeText={(colonia) => updateGeofence({ colonia })} placeholder="Ej. Centro" />
              <FormInput label="Código postal" value={draft?.geofence?.codigoPostal ?? ''} onChangeText={(codigoPostal) => updateGeofence({ codigoPostal: codigoPostal.replace(/\D/g, '').slice(0, 5) })} placeholder="Ej. 97000" keyboardType="numeric" />
              <FormInput label="Ciudad" value={draft?.geofence?.ciudad ?? ''} onChangeText={(ciudad) => updateGeofence({ ciudad })} placeholder="Ej. Mérida" />
              <FormInput label="Estado" value={draft?.geofence?.estado ?? ''} onChangeText={(estado) => updateGeofence({ estado })} placeholder="Ej. Yucatán" />
              <View style={styles.geoActions}>
                <Pressable accessibilityRole="button" disabled={geoLoading} onPress={locateGeofence} style={styles.addMedicationButton}>
                  {geoLoading ? <ActivityIndicator color={colors.tealDark} /> : <Text style={styles.addMedicationText}>Buscar en mapa</Text>}
                </Pressable>
                <Pressable accessibilityRole="button" disabled={geoLocating} onPress={useCurrentGeofenceLocation} style={styles.addMedicationButton}>
                  {geoLocating ? <ActivityIndicator color={colors.tealDark} /> : <Text style={styles.addMedicationText}>Usar ubicación actual</Text>}
                </Pressable>
              </View>
              {geoSuggestions.length > 0 && (
                <View style={styles.suggestionBox}>
                  {geoSuggestions.map((s, idx) => (
                    <Pressable key={`${s.label}-${idx}`} onPress={() => updateGeofence({ latitud: s.coordinates.latitude, longitud: s.coordinates.longitude, calle: s.calle ?? draft?.geofence?.calle, colonia: s.colonia ?? draft?.geofence?.colonia, codigoPostal: s.codigoPostal ?? draft?.geofence?.codigoPostal, ciudad: s.ciudad ?? draft?.geofence?.ciudad, estado: s.estado ?? draft?.geofence?.estado })} style={styles.suggestionItem}>
                      <Text style={styles.suggestionText}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {draft?.geofence?.latitud && draft?.geofence?.longitud ? (
                <View style={styles.mapPreview}>
                  <OpenStreetMapView
                    center={{ latitude: draft.geofence.latitud, longitude: draft.geofence.longitud }}
                    markers={[{ id: 'geofence', label: [draft.geofence.calle, draft.geofence.colonia, draft.geofence.ciudad, draft.geofence.estado].filter(Boolean).join(', ') || draft.geofence.nombre || 'Ubicación', rate: draft.geofence.nombre || 'Ubicación', latitude: draft.geofence.latitud, longitude: draft.geofence.longitud }]}
                    showCurrentLocation={false}
                  />
                </View>
              ) : null}
              <FormInput label="Nombre de la ubicación" value={draft?.geofence?.nombre ?? 'Casa'} onChangeText={(nombre) => updateGeofence({ nombre })} placeholder="Casa de abuelo" />
              <FormInput label="Radio (metros)" value={String(draft?.geofence?.radio_metros ?? 100)} onChangeText={(v) => updateGeofence({ radio_metros: Number(v.replace(/\D/g, '') || '100') })} placeholder="100" keyboardType="numeric" />
              {draft?.geofence?.latitud && draft?.geofence?.longitud ? (
                <View style={styles.geoRow}>
                  <Text style={styles.sectionHint}>Ubicación seleccionada en el mapa.</Text>
                  <Pressable accessibilityRole="button" onPress={() => { updateGeofence({ latitud: 0, longitud: 0 }); setGeoSuggestions([]); }}>
                    <Text style={styles.removeLinkText}>Quitar ubicación</Text>
                  </Pressable>
                </View>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" onPress={() => {
                setGeoModalOpen(false);
                setGeofenceBeforeEdit(undefined);
              }} style={styles.saveButton}><Text style={styles.saveButtonText}>Listo</Text></Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!medModal && !!draft} animationType="fade" transparent onRequestClose={() => setPendingConfirmation({ type: 'discardMedication' })}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={styles.modalKeyboardAvoiding}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.formTitle}>{draft?.medications.some((m) => m.id === medModal?.id) ? 'Editar medicamento' : 'Nuevo medicamento'}</Text>
              <FormInput label="Nombre" value={medModal?.name ?? ''} onChangeText={(name) => setMedModal((m) => m ? { ...m, name } : m)} placeholder="Nombre del medicamento" />
              <FormInput label="Dosis" value={medModal?.dosage ?? ''} onChangeText={(dosage) => setMedModal((m) => m ? { ...m, dosage } : m)} placeholder="Ej. 1 tableta" />
              <FormInput label="Horario" value={medModal?.schedule ?? ''} onChangeText={(schedule) => setMedModal((m) => m ? { ...m, schedule } : m)} placeholder="Ej. Cada 8 horas" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" onPress={() => {
                if (!draft || !medModal) return;
                if (!medModal.name.trim() || !medModal.dosage.trim() || !medModal.schedule.trim()) { setError('Completa nombre, dosis y horario del medicamento.'); return; }
                const exists = draft.medications.some((m) => m.id === medModal.id);
                updateDraft({ medications: exists ? draft.medications.map((m) => m.id === medModal.id ? medModal : m) : [...draft.medications, medModal] });
                setError('');
                setMedModal(null);
              }} style={styles.saveButton}><Text style={styles.saveButtonText}>Guardar medicamento</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setPendingConfirmation({ type: 'discardMedication' })} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Cancelar</Text></Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmationModal
        visible={!!pendingConfirmation}
        title={pendingConfirmation?.type === 'deleteProfile'
          ? '¿Eliminar perfil?'
          : pendingConfirmation?.type === 'removeMedication'
            ? '¿Quitar medicamento?'
            : '¿Descartar cambios?'}
        message={pendingConfirmation?.type === 'deleteProfile'
          ? `Se eliminará el perfil de ${pendingConfirmation.profile.name} y sus datos asociados.`
          : pendingConfirmation?.type === 'removeMedication'
            ? 'Este medicamento se quitará de la lista. Recuerda guardar los cambios del perfil.'
            : pendingConfirmation?.type === 'discardRecipient'
              ? 'Se cerrará el formulario y se perderán los cambios que no hayas guardado.'
              : pendingConfirmation?.type === 'discardMedication'
                ? 'Se cerrará el formulario del medicamento y se perderán los cambios sin guardar.'
                : 'Se cerrará la edición de ubicación. Los cambios del perfil se conservarán solo al guardar.'}
        confirmLabel={pendingConfirmation?.type === 'deleteProfile' || pendingConfirmation?.type === 'removeMedication' ? 'Sí, eliminar' : 'Descartar'}
        destructive={pendingConfirmation?.type === 'deleteProfile' || pendingConfirmation?.type === 'removeMedication'}
        loading={loading && pendingConfirmation?.type === 'deleteProfile'}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => { void confirmPendingAction(); }}
      />

      <Text style={styles.disclaimer}>Estos datos se guardan en tu cuenta cuando hay conexión.</Text>
    </View>
  );
}

function isValidBirthDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function toIsoBirthDate(value: string) {
  const [day, month, year] = value.trim().split('/');
  return `${year}-${month}-${day}`;
}

function isoToDisplayBirthDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function FormInput({
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.line}
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  section: { alignSelf: 'stretch', marginTop: 24 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  sectionHeading: { flex: 1, paddingRight: 8 },
  sectionTitle: { color: colors.tealDark, fontSize: 15, fontWeight: '800', textAlign: 'left' },
  sectionHint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3, textAlign: 'left' },
  addButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 12, flexDirection: 'row', gap: 5, paddingHorizontal: 13, paddingVertical: 10 },
  addButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  emptyCard: { alignItems: 'center', backgroundColor: colors.canvas, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: 'row', padding: 16 },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.tealPale, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  emptyCopy: { flex: 1, marginLeft: 12 },
  emptyTitle: { color: colors.tealDark, fontSize: 11, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4, textAlign: 'left' },
  profileCard: { alignItems: 'stretch', alignSelf: 'stretch', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, marginBottom: 10, padding: 15, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8 },
  profileHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  profileIdentity: { flex: 1, paddingRight: 8 },
  profileName: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'left' },
  profileBirthDate: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: 'left' },
  textButton: { paddingHorizontal: 6, paddingVertical: 4 },
  textButtonLabel: { color: colors.tealDark, fontSize: 10, fontWeight: '800' },
  detailRow: { marginTop: 9 },
  detailLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', textAlign: 'left' },
  detailValue: { color: colors.ink, fontSize: 10, lineHeight: 15, marginTop: 3, textAlign: 'left' },
  medicationHeading: { color: colors.tealDark, fontSize: 10, fontWeight: '800', marginTop: 12, textAlign: 'left' },
  medicationSummary: { borderLeftColor: colors.teal, borderLeftWidth: 2, marginTop: 7, paddingLeft: 8 },
  medicationName: { color: colors.ink, fontSize: 10, fontWeight: '700', textAlign: 'left' },
  medicationDescription: { color: colors.muted, fontSize: 9, marginTop: 3, textAlign: 'left' },
  noMedication: { color: colors.muted, fontSize: 9, marginTop: 5, textAlign: 'left' },
  removeLink: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 },
  removeLinkText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  modalBackdrop: { alignItems: 'center', backgroundColor: colors.ink, flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 24 },
  modalKeyboardAvoiding: { flex: 1 },
  modalCard: { backgroundColor: colors.canvas, borderRadius: 24, maxHeight: '90%', maxWidth: 520, width: '100%' },
  modalContent: { padding: 20, paddingBottom: 24 },
  formCard: { alignItems: 'stretch', alignSelf: 'stretch', backgroundColor: colors.canvas, borderRadius: 13, marginTop: 2, padding: 13 },
  formTitle: { color: colors.tealDark, fontSize: 13, fontWeight: '800', marginBottom: 13, textAlign: 'left' },
  inputGroup: { marginBottom: 11 },
  formLabel: { color: colors.ink, fontSize: 10, fontWeight: '700', marginBottom: 5, textAlign: 'left' },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 11, minHeight: 40, paddingHorizontal: 10, paddingVertical: 9, textAlign: 'left' },
  multilineInput: { minHeight: 58, textAlignVertical: 'top' },
  medicationFormHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, marginTop: 2 },
  addMedicationButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 9, paddingVertical: 6 },
  addMedicationText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  medicationForm: { backgroundColor: colors.surface, borderRadius: 10, marginBottom: 9, padding: 10 },
  medicationSummaryRow: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, flexDirection: 'row', gap: 8, marginBottom: 8, padding: 10 },
  medicationFormTitle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  medicationIndex: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  geoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  geoActions: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  suggestionBox: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, marginBottom: 10, marginTop: 8 },
  suggestionItem: { borderBottomColor: colors.line, borderBottomWidth: 1, padding: 10 },
  suggestionText: { color: colors.ink, fontSize: 10, lineHeight: 14 },
  mapPreview: { borderRadius: 12, height: 180, marginBottom: 10, overflow: 'hidden' },
  error: { color: colors.accent, fontSize: 10, lineHeight: 15, marginBottom: 8, textAlign: 'left' },
  saveButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 10, marginTop: 4, paddingVertical: 11 },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelButtonText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  disclaimer: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 12, textAlign: 'center' },
}));
