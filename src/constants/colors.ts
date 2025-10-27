import { Platform } from 'react-native';

const colors = {
  PRIMARY: {
    DEFAULT: '#007AFF',
    LIGHT: '#4DA2FF',
    DARK: '#0055B3',
  },
  SECONDARY: {
    DEFAULT: '#5856D6',
    LIGHT: '#7A79E0',
    DARK: '#3D3C96',
  },
  SUCCESS: {
    DEFAULT: '#34C759',
    LIGHT: '#5CD679',
    DARK: '#248A3D',
  },
  DANGER: {
    DEFAULT: '#FF3B30',
    LIGHT: '#FF6961',
    DARK: '#B32921',
  },
  WARNING: {
    DEFAULT: '#FF9500',
    LIGHT: '#FFAA33',
    DARK: '#B36800',
  },
  INFO: {
    DEFAULT: '#5856D6',
    LIGHT: '#7A79E0',
    DARK: '#3D3C96',
  },
  GRAY: {
    DEFAULT: '#8E8E93',
    LIGHT: '#AEAEB2',
    DARK: '#636366',
  },
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  TRANSPARENT: 'transparent',
} as const;

export type ThemeColors = typeof colors & {
  background: string;
  text: string;
  card: string;
  border: string;
};

export default colors; 