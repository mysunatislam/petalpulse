import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useApp } from '../store/app';
import { dark, light, Theme } from './tokens';

export function useTheme(): Theme {
  const pref = useApp((s) => s.settings.theme);
  const system = useColorScheme();
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  return isDark ? dark : light;
}

/** True when either the OS or the in-app setting asks for less motion. */
export function useMotionOff(): boolean {
  const os = useReducedMotion();
  const app = useApp((s) => s.settings.reduceMotion);
  return os || app;
}
