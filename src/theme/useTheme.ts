import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useApp } from '../store/app';
import { dark, hcDark, hcLight, light, Theme } from './tokens';

export function useTheme(): Theme {
  const pref = useApp((s) => s.settings.theme);
  const hc = useApp((s) => s.settings.highContrast);
  const system = useColorScheme();
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  if (hc) return isDark ? hcDark : hcLight;
  return isDark ? dark : light;
}

/** Extra text size chosen in the app, applied on top of the phone's font size. */
export function useTextScale(): number {
  return useApp((s) => s.settings.textScale) ?? 1;
}

/** Minimum touch height: 48 normally, 56 with larger touch areas. */
export function useTarget(base: number): number {
  const big = useApp((s) => s.settings.largeTargets);
  return big ? Math.max(base, 56) : base;
}

/** True when either the OS or the in-app setting asks for less motion. */
export function useMotionOff(): boolean {
  const os = useReducedMotion();
  const app = useApp((s) => s.settings.reduceMotion);
  return os || app;
}
