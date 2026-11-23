import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import { CareRecipient, Medication } from '../types';

type Props = {
  profiles: CareRecipient[];
  onSave: (recipient: CareRecipient) => void;
  onDelete: (recipientId: string) => void;
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createRecipient = (): CareRecipient => ({
  id: createId(),
  name: '',
  birthDate: '',
  conditions: '',
  notes: '',
  medications: [],
});

export function ClientProfileSection({ profiles, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<CareRecipient | null>(null);
  const [error, setError] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const updateDraft = (updates: Partial<CareRecipient>) => {
    setDraft((current) => (current ? { ...current, ...updates } : current));
    setError('');
  };

  const updateMedication = (id: string, updates: Partial<Medication>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            medications: current.medications.map((medication) =>
              medication.id === id ? { ...medication, ...updates } : medication,
            ),
          }
        : current,
    );
    setError('');
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

  const saveDraft = () => {
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

    onSave({
      ...draft,
      name: draft.name.trim(),
      conditions: draft.conditions.trim(),
      notes: draft.notes.trim(),
      medications,
    });
    setDraft(null);
    setError('');
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Personas a cuidar</Text>
          <Text style={styles.sectionHint}>Agrega sus datos de salud y medicamentos.</Text>
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
            <Text style={styles.addButtonText}>+ Agregar</Text>
          </Pressable>
        )}
      </View>

      {profiles.length === 0 && !draft ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aún no agregas a nadie</Text>
          <Text style={styles.emptyText}>Registra a la persona para quien buscas cuidado.</Text>
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
            <Text style={styles.medicationHeading}>
              Medicamentos{profile.medications.length ? ` · ${profile.medications.length}` : ''}
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
            {deleteConfirmation === profile.id ? (
              <View style={styles.deleteConfirmation}>
                <Text style={styles.confirmText}>¿Eliminar este perfil?</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onDelete(profile.id);
                    setDeleteConfirmation(null);
                  }}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </Pressable>
                <Pressable onPress={() => setDeleteConfirmation(null)} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>Cancelar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setDeleteConfirmation(profile.id)} style={styles.removeLink}>
                <Text style={styles.removeLinkText}>Eliminar perfil</Text>
              </Pressable>
            )}
          </View>
        ))
      )}

      {draft && (
        <View style={styles.formCard}>
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
              <Text style={styles.formLabel}>Medicamentos</Text>
              <Text style={styles.sectionHint}>Opcional</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const medication: Medication = { id: createId(), name: '', dosage: '', schedule: '' };
                updateDraft({ medications: [...draft.medications, medication] });
              }}
              style={styles.addMedicationButton}
            >
              <Text style={styles.addMedicationText}>+ Añadir</Text>
            </Pressable>
          </View>
          {draft.medications.map((medication, index) => (
            <View key={medication.id} style={styles.medicationForm}>
              <View style={styles.medicationFormTitle}>
                <Text style={styles.medicationIndex}>Medicamento {index + 1}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    updateDraft({
                      medications: draft.medications.filter((item) => item.id !== medication.id),
                    })
                  }
                >
                  <Text style={styles.removeLinkText}>Quitar</Text>
                </Pressable>
              </View>
              <FormInput
                label="Nombre"
                value={medication.name}
                onChangeText={(name) => updateMedication(medication.id, { name })}
                placeholder="Nombre del medicamento"
              />
              <FormInput
                label="Dosis"
                value={medication.dosage}
                onChangeText={(dosage) => updateMedication(medication.id, { dosage })}
                placeholder="Ej. 1 tableta"
              />
              <FormInput
                label="Horario"
                value={medication.schedule}
                onChangeText={(schedule) => updateMedication(medication.id, { schedule })}
                placeholder="Ej. Cada 8 horas"
              />
            </View>
          ))}

          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" onPress={saveDraft} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Guardar datos</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setDraft(null); setError(''); }} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.disclaimer}>Estos datos solo permanecen en esta sesión de demostración.</Text>
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
        placeholderTextColor={colors.muted}
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

const styles = StyleSheet.create({
  section: { alignSelf: 'stretch', marginTop: 22 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeading: { flex: 1, paddingRight: 8 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'left' },
  sectionHint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3, textAlign: 'left' },
  addButton: { backgroundColor: colors.tealPale, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  addButtonText: { color: colors.tealDark, fontSize: 11, fontWeight: '800' },
  emptyCard: { alignItems: 'flex-start', backgroundColor: colors.canvas, borderRadius: 12, padding: 13 },
  emptyTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4, textAlign: 'left' },
  profileCard: { alignItems: 'stretch', alignSelf: 'stretch', backgroundColor: colors.canvas, borderRadius: 13, marginBottom: 10, padding: 13 },
  profileHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  profileIdentity: { flex: 1, paddingRight: 8 },
  profileName: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'left' },
  profileBirthDate: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: 'left' },
  textButton: { paddingHorizontal: 6, paddingVertical: 4 },
  textButtonLabel: { color: colors.tealDark, fontSize: 10, fontWeight: '800' },
  detailRow: { marginTop: 9 },
  detailLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', textAlign: 'left' },
  detailValue: { color: colors.ink, fontSize: 10, lineHeight: 15, marginTop: 3, textAlign: 'left' },
  medicationHeading: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 12, textAlign: 'left' },
  medicationSummary: { borderLeftColor: colors.teal, borderLeftWidth: 2, marginTop: 7, paddingLeft: 8 },
  medicationName: { color: colors.ink, fontSize: 10, fontWeight: '700', textAlign: 'left' },
  medicationDescription: { color: colors.muted, fontSize: 9, marginTop: 3, textAlign: 'left' },
  noMedication: { color: colors.muted, fontSize: 9, marginTop: 5, textAlign: 'left' },
  removeLink: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 },
  removeLinkText: { color: '#B64B47', fontSize: 10, fontWeight: '700' },
  deleteConfirmation: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10 },
  confirmText: { color: colors.ink, flex: 1, fontSize: 10, fontWeight: '700', textAlign: 'left' },
  deleteButton: { backgroundColor: '#FCECEB', borderRadius: 8, marginRight: 4, paddingHorizontal: 8, paddingVertical: 6 },
  deleteButtonText: { color: '#B64B47', fontSize: 10, fontWeight: '800' },
  formCard: { alignItems: 'stretch', alignSelf: 'stretch', backgroundColor: colors.canvas, borderRadius: 13, marginTop: 2, padding: 13 },
  formTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 13, textAlign: 'left' },
  inputGroup: { marginBottom: 11 },
  formLabel: { color: colors.ink, fontSize: 10, fontWeight: '700', marginBottom: 5, textAlign: 'left' },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 11, minHeight: 40, paddingHorizontal: 10, paddingVertical: 9, textAlign: 'left' },
  multilineInput: { minHeight: 58, textAlignVertical: 'top' },
  medicationFormHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, marginTop: 2 },
  addMedicationButton: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  addMedicationText: { color: colors.tealDark, fontSize: 10, fontWeight: '700' },
  medicationForm: { backgroundColor: colors.white, borderRadius: 10, marginBottom: 9, padding: 10 },
  medicationFormTitle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  medicationIndex: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  error: { color: '#B64B47', fontSize: 10, lineHeight: 15, marginBottom: 8, textAlign: 'left' },
  saveButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 10, marginTop: 4, paddingVertical: 11 },
  saveButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelButtonText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  disclaimer: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 12, textAlign: 'center' },
});
