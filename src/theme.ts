export type ThemeMode = 'light' | 'dark';

const lightPalette = {
  ink: '#0F1C30',
  muted: '#668DC0',
  secondary: '#668DC0',
  teal: '#304A6E',
  tealDark: '#304A6E',
  tealPale: '#C0D0EF',
  canvas: '#F7F9FC',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  line: '#C2C6CE',
  green: '#668DC0',
  gold: '#668DC0',
  map: '#F7F9FC',
  soft: '#C0D0EF',
  highlightSoft: '#C0D0EF',
};

const darkPalette = {
  ink: '#FFFFFF',
  muted: '#C2C6CE',
  secondary: '#C2C6CE',
  teal: '#304A6E',
  tealDark: '#FFFFFF',
  tealPale: '#668DC0',
  canvas: '#0F1C30',
  surface: '#304A6E',
  white: '#FFFFFF',
  line: '#668DC0',
  green: '#668DC0',
  gold: '#C0D0EF',
  map: '#0F1C30',
  soft: '#304A6E',
  highlightSoft: '#304A6E',
};

export const colors = { ...lightPalette };
export const secondaryColors = {
  ...lightPalette,
  accent: lightPalette.tealDark,
  highlight: lightPalette.tealPale,
};

const styleRefreshers: (() => void)[] = [];

export function createThemedStyles<T extends object>(factory: () => T): T {
  let styles = factory();
  styleRefreshers.push(() => {
    styles = factory();
  });
  return new Proxy({} as T, {
    get: (_target, key: string | symbol) => styles[key as keyof T],
  });
}

export function setThemeMode(mode: ThemeMode) {
  const palette = mode === 'dark' ? darkPalette : lightPalette;
  Object.assign(colors, palette);
  Object.assign(secondaryColors, palette, {
    accent: palette.tealDark,
    highlight: palette.tealPale,
  });
  styleRefreshers.forEach((refresh) => refresh());
}

export const profilePalette = {
  get canvas() { return colors.canvas; },
  get white() { return colors.white; },
  get surface() { return colors.surface; },
  get ink() { return colors.ink; },
  get primary() { return colors.teal; },
  get secondary() { return colors.muted; },
  get light() { return colors.tealPale; },
  get neutral() { return colors.line; },
};
