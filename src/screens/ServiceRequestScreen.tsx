import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createServicio, getAbuelos, updateServicio } from '../api/auth';
import { colors } from '../theme';
import type { Caregiver, Servicio } from '../types';
import { mapServicio } from '../utils/servicio';

type Props = {
  caregiver?: Caregiver;
  servicio?: Servicio;
  token: string;
  onBack: () => void;
  onCreated: (servicio: Servicio) => void;
};

type Patient = { id: number; nombre: string };

function localDateTime(offsetHours: number) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (item: number) => String(item).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ServiceRequestScreen({ caregiver, servicio, token, onBack, onCreated }: Props) {
  const isEditing = !!servicio;
  const caregiverName = servicio?.cuidador_nombre ?? caregiver?.name ?? 'Cuidador';
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedAbueloId, setSelectedAbueloId] = useState<number | null>(servicio?.abuelo_id ?? null);
  const [nota, setNota] = useState(servicio?.nota ?? `Servicio de acompañamiento con ${caregiverName}`);
  const [inicio, setInicio] = useState(() => toLocalInput(servicio?.inicio) || localDateTime(1));
  const [fin, setFin] = useState(() => toLocalInput(servicio?.fin) || localDateTime(3));
  const [tarifaHora, setTarifaHora] = useState(String(servicio?.tarifa_hora ?? caregiver?.hourlyRate ?? 0));
  const [comision, setComision] = useState(String(servicio?.comision ?? 5));
  const [estado, setEstado] = useState(servicio?.estado ?? 'activo');
  const [estadoPago, setEstadoPago] = useState(servicio?.estado_pago ?? 'pendiente');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getAbuelos(token);
        if (!active) return;
        const list = data
          .map((item) => ({ id: Number(item.id), nombre: String(item.nombre ?? `Paciente ${String(item.id ?? '')}`) }))
          .filter((item) => Number.isFinite(item.id) && item.id > 0);
        setPatients(list);
        setSelectedAbueloId((current) => current ?? list[0]?.id ?? null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus pacientes.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [token]);

  const hours = useMemo(() => {
    const start = new Date(inicio).getTime();
    const end = new Date(fin).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return (end - start) / (60 * 60 * 1000);
  }, [inicio, fin]);

  const total = useMemo(() => Number(tarifaHora || 0) * hours, [tarifaHora, hours]);

  const submit = async () => {
    const cuidadorId = Number(servicio?.cuidador_id ?? caregiver?.id);
    if (!selectedAbueloId) { setError('Selecciona un paciente para el servicio.'); return; }
    if (!Number.isFinite(cuidadorId)) { setError('El cuidador elegido no tiene un identificador válido.'); return; }
    if (hours <= 0) { setError('La hora de fin debe ser posterior a la de inicio.'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEditing && servicio) {
        const response = await updateServicio(servicio.id, {
          nota: nota.trim() || `Servicio con ${caregiverName}`,
          inicio: toIso(inicio),
          fin: toIso(fin),
          tarifa_hora: Number(tarifaHora || 0),
          total,
          comision: Number(comision || 0),
          estado,
          estado_pago: estadoPago,
        }, token);
        onCreated(mapServicio(response));
      } else {
        const response = await createServicio({
          abuelo_id: selectedAbueloId,
          cuidador_id: cuidadorId,
          nota: nota.trim() || `Servicio con ${caregiverName}`,
          inicio: toIso(inicio),
          fin: toIso(fin),
          tarifa_hora: Number(tarifaHora || 0),
          total,
          comision: Number(comision || 0),
          estado: 'activo',
          estado_pago: 'pendiente',
        }, token);
        onCreated(mapServicio(response));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : isEditing ? 'No se pudo actualizar el servicio.' : 'No se pudo enviar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      keyboardVerticalOffset={0}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <Pressable accessibilityLabel="Volver" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.eyebrow}>{isEditing ? 'EDITAR SERVICIO' : 'NUEVA SOLICITUD'}</Text>
        <Text style={styles.title}>{isEditing ? 'Editar servicio' : 'Solicitar servicio'}</Text>
        <Text style={styles.subtitle}>{isEditing ? `Servicio #${servicio?.id} con ${caregiverName}.` : `Se enviará a ${caregiverName} con los datos del cuidado.`}</Text>

        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Paciente</Text>
            {loading ? <ActivityIndicator color={colors.tealDark} /> : null}
            {!loading && patients.length === 0 && (
              <Text style={styles.helper}>Agrega un paciente en Mi cuenta para poder solicitar el servicio.</Text>
            )}
            {patients.map((patient) => (
              <Pressable
                accessibilityRole="button"
                key={patient.id}
                onPress={() => setSelectedAbueloId(patient.id)}
                style={[styles.patientCard, selectedAbueloId === patient.id && styles.selectedPatientCard]}
              >
                <View style={styles.patientAvatar}><Text style={styles.patientAvatarText}>{patient.nombre.charAt(0).toUpperCase()}</Text></View>
                <Text style={styles.patientName}>{patient.nombre}</Text>
                <Text style={styles.patientId}>ID {patient.id}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles del servicio</Text>
          <Text style={styles.label}>Nota</Text>
          <TextInput multiline numberOfLines={3} onChangeText={setNota} style={styles.input} value={nota} />
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Inicio</Text>
              <TextInput onChangeText={setInicio} style={styles.input} value={inicio} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Fin</Text>
              <TextInput onChangeText={setFin} style={styles.input} value={fin} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Tarifa por hora</Text>
              <TextInput keyboardType="numeric" onChangeText={setTarifaHora} style={styles.input} value={tarifaHora} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Comisión</Text>
              <TextInput keyboardType="numeric" onChangeText={setComision} style={styles.input} value={comision} />
            </View>
          </View>
          {isEditing && (
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Estado</Text>
                <TextInput onChangeText={setEstado} style={styles.input} value={estado} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Pago</Text>
                <TextInput onChangeText={setEstadoPago} style={styles.input} value={estadoPago} />
              </View>
            </View>
          )}
          <Text style={styles.helper}>Formato de fechas: AAAA-MM-DDTHH:mm</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuidador elegido</Text>
          <View style={styles.caregiverCard}>
            <View style={styles.patientAvatar}><Text style={styles.patientAvatarText}>{caregiverName.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{caregiverName}</Text>
              <Text style={styles.helper}>{caregiver?.title ?? `ID ${servicio?.cuidador_id ?? ''}`}</Text>
            </View>
            <Text style={styles.caregiverRate}>${tarifaHora}/h</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Horas</Text><Text style={styles.summaryValue}>{hours.toFixed(2)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total</Text><Text style={styles.summaryTotal}>${total.toFixed(2)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Estado</Text><Text style={styles.summaryValue}>{isEditing ? estado : 'Pendiente de aceptación'}</Text></View>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.bottom}>
        <Pressable disabled={saving || !selectedAbueloId} onPress={() => void submit()} style={[styles.submitButton, (saving || !selectedAbueloId) && styles.submitButtonDisabled]}>
          <Text style={styles.submitText}>{saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Enviar solicitud'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 24 },
  backButton: { backgroundColor: colors.white, borderRadius: 20, height: 38, justifyContent: 'center', position: 'absolute', left: 18, top: 12, width: 38 },
  backText: { color: colors.ink, fontSize: 30, lineHeight: 34, marginLeft: 11, marginTop: -3 },
  eyebrow: { color: colors.tealDark, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.tealDark, fontSize: 24, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  section: { backgroundColor: colors.white, borderRadius: 18, marginTop: 18, padding: 14 },
  sectionTitle: { color: colors.tealDark, fontSize: 13, fontWeight: '800', marginBottom: 10 },
  patientCard: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: 13, flexDirection: 'row', marginBottom: 8, padding: 10 },
  selectedPatientCard: { backgroundColor: colors.tealPale, borderColor: colors.tealDark, borderWidth: 1 },
  patientAvatar: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  patientAvatarText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  patientName: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: '700', marginLeft: 10 },
  patientId: { color: colors.muted, fontSize: 9 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '700', marginBottom: 5, marginTop: 8 },
  input: { backgroundColor: colors.canvas, borderRadius: 10, color: colors.ink, fontSize: 11, paddingHorizontal: 11, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 9 },
  field: { flex: 1 },
  helper: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 7 },
  caregiverCard: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: 13, flexDirection: 'row', padding: 10 },
  caregiverRate: { color: colors.tealDark, fontSize: 11, fontWeight: '800' },
  summary: { backgroundColor: colors.tealPale, borderRadius: 18, marginTop: 18, padding: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  summaryLabel: { color: colors.muted, fontSize: 11 },
  summaryValue: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  summaryTotal: { color: colors.tealDark, fontSize: 14, fontWeight: '800' },
  error: { color: colors.tealDark, fontSize: 11, lineHeight: 16, marginTop: 14 },
  bottom: { backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  submitButton: { alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: 14, justifyContent: 'center', paddingVertical: 14 },
  submitButtonDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
