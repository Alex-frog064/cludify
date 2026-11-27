import { Children, type ReactNode } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';
import { useAppSettings } from '../context/AppSettingsContext';
import { translateText } from '../i18n';

function localizeChildren(children: ReactNode, language: 'es' | 'en') {
  return Children.map(children, (child) =>
    typeof child === 'string' ? translateText(child, language) : child,
  );
}

export function LocalizedText({ children, accessibilityLabel, ...props }: TextProps) {
  const { language } = useAppSettings();
  return (
    <NativeText
      {...props}
      accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel, language) : undefined}
    >
      {localizeChildren(children, language)}
    </NativeText>
  );
}

export function LocalizedTextInput({ placeholder, accessibilityLabel, ...props }: TextInputProps) {
  const { language } = useAppSettings();
  return (
    <NativeTextInput
      {...props}
      accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel, language) : undefined}
      placeholder={placeholder ? translateText(placeholder, language) : undefined}
    />
  );
}
