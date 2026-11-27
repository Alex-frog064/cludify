import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setThemeMode, type ThemeMode } from '../theme';

export type AppLanguage = 'es' | 'en';

export type NotificationPreferences = {
  care: boolean;
  messages: boolean;
  updates: boolean;
};

export type AppSettings = {
  themeMode: ThemeMode;
  language: AppLanguage;
  notifications: NotificationPreferences;
};

export type AppSettingsPatch = Omit<Partial<AppSettings>, 'notifications'> & {
  notifications?: Partial<NotificationPreferences>;
};

type AppSettingsContextValue = AppSettings & {
  ready: boolean;
  persistenceError: string;
  updateSettings: (patch: AppSettingsPatch) => Promise<void>;
};

const STORAGE_KEY = 'cludify-app-settings-v1';
const defaults: AppSettings = {
  themeMode: 'light',
  language: 'es',
  notifications: { care: true, messages: true, updates: true },
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function isLanguage(value: unknown): value is AppLanguage {
  return value === 'es' || value === 'en';
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return defaults;
  const stored = value as Partial<AppSettings>;
  const notificationSettings = stored.notifications;
  return {
    themeMode: isThemeMode(stored.themeMode) ? stored.themeMode : defaults.themeMode,
    language: isLanguage(stored.language) ? stored.language : defaults.language,
    notifications: {
      care: typeof notificationSettings?.care === 'boolean' ? notificationSettings.care : defaults.notifications.care,
      messages: typeof notificationSettings?.messages === 'boolean' ? notificationSettings.messages : defaults.notifications.messages,
      updates: typeof notificationSettings?.updates === 'boolean' ? notificationSettings.updates : defaults.notifications.updates,
    },
  };
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState('');
  const settingsRef = useRef(settings);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const next = stored ? normalizeSettings(JSON.parse(stored) as unknown) : defaults;
        if (!active) return;
        settingsRef.current = next;
        setSettings(next);
        setThemeMode(next.themeMode);
      } catch (error) {
        if (active) {
          setPersistenceError(error instanceof Error ? error.message : 'No se pudieron cargar las preferencias guardadas.');
        }
      } finally {
        if (active) setReady(true);
      }
    };
    void loadSettings();
    return () => { active = false; };
  }, []);

  const updateSettings = useCallback(async (patch: AppSettingsPatch) => {
    const next: AppSettings = {
      ...settingsRef.current,
      ...patch,
      notifications: patch.notifications
        ? { ...settingsRef.current.notifications, ...patch.notifications }
        : settingsRef.current.notifications,
    };
    settingsRef.current = next;
    setSettings(next);
    setThemeMode(next.themeMode);
    setPersistenceError('');

    const write = writeQueue.current.then(() =>
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)),
    );
    writeQueue.current = write.catch(() => undefined);
    try {
      await write;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron guardar las preferencias.';
      setPersistenceError(message);
      throw new Error(message);
    }
  }, []);

  const value = useMemo(() => ({
    ...settings,
    ready,
    persistenceError,
    updateSettings,
  }), [settings, ready, persistenceError, updateSettings]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(AppSettingsContext);
  if (!value) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider.');
  }
  return value;
}
