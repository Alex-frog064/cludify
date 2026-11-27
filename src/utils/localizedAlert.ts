import { Alert } from 'react-native';
import type { AppLanguage } from '../context/AppSettingsContext';
import { translateText } from '../i18n';

type AlertButtons = NonNullable<Parameters<typeof Alert.alert>[2]>;

export function showLocalizedAlert(
  language: AppLanguage,
  title: string,
  message?: string,
  buttons?: AlertButtons,
) {
  Alert.alert(
    translateText(title, language),
    message ? translateText(message, language) : undefined,
    buttons?.map((button) => ({
      ...button,
      text: button.text ? translateText(button.text, language) : undefined,
    })),
  );
}
