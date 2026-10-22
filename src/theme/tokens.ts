import type { Phase } from '../engines/cycle';

export const palette = {
  blush: '#F7DCE5',
  rose: '#D992AA',
  lavender: '#E9E1F8',
  ivory: '#FFF9F5',
  peach: '#FFDCCB',
  sage: '#CADCCB',
  plum: '#49364B',
};

export interface Theme {
  dark: boolean;
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceGlass: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  primary: string; // dusty rose
  primaryText: string;
  accent: string; // plum, buttons
  accentText: string;
  lavender: string;
  peach: string;
  sage: string;
  blush: string;
  danger: string;
  dangerBg: string;
  warn: string;
  warnBg: string;
  gradient: [string, string, string];
  heroGradient: [string, string];
  shadow: string;
}

export const light: Theme = {
  dark: false,
  bg: palette.ivory,
  bgAlt: '#FBF1F3',
  surface: '#FFFFFF',
  surfaceGlass: 'rgba(255,255,255,0.72)',
  border: 'rgba(73,54,75,0.10)',
  text: palette.plum,
  textMuted: '#6E5A70', // 6.0:1 on ivory
  textSoft: '#735F75', // ≥4.5:1 on white, ivory and blush
  primary: palette.rose,
  primaryText: '#8C4462', // rose text with 5.9:1 contrast on white
  accent: palette.plum,
  accentText: '#FFFFFF',
  lavender: palette.lavender,
  peach: palette.peach,
  sage: palette.sage,
  blush: palette.blush,
  danger: '#A3243F',
  dangerBg: '#FCE4E8',
  warn: '#8A5A00',
  warnBg: '#FFF1D6',
  gradient: [palette.ivory, palette.blush, palette.lavender],
  heroGradient: ['#FFF4F1', '#F3E8FA'],
  shadow: 'rgba(73,54,75,0.12)',
};

export const dark: Theme = {
  dark: true,
  bg: '#1E1620',
  bgAlt: '#261C29',
  surface: '#2C2130',
  surfaceGlass: 'rgba(52,39,56,0.78)',
  border: 'rgba(247,220,229,0.12)',
  text: '#F6EDF2',
  textMuted: '#D3C2D2',
  textSoft: '#B6A3B6',
  primary: '#E7A9BE',
  primaryText: '#F2B9CC',
  accent: '#F7DCE5',
  accentText: palette.plum,
  lavender: '#3A2F48',
  peach: '#4A3330',
  sage: '#2F3E33',
  blush: '#43293A',
  danger: '#FF9DB0',
  dangerBg: '#4A2230',
  warn: '#FFD27A',
  warnBg: '#3F3220',
  gradient: ['#1E1620', '#2A1D2C', '#2B2238'],
  heroGradient: ['#2C2030', '#2A2337'],
  shadow: 'rgba(0,0,0,0.4)',
};

/** Petal Compass petal colours per phase (visual metaphor only). */
export const PHASE_PETALS: Record<Phase, { petals: string[]; core: string; glow: string; label: string }> = {
  menstrual: { petals: ['#E8A3B9', '#D992AA', '#F2C1D0'], core: '#B86B86', glow: '#F7DCE5', label: 'Soft rose' },
  follicular: { petals: ['#FFDCCB', '#F9C8B0', '#CADCCB'], core: '#E9A98B', glow: '#FFEFE6', label: 'Fresh peach & sage' },
  ovulatory: { petals: ['#D9CBF4', '#C8B6EE', '#E9E1F8'], core: '#9F86D6', glow: '#F1ECFC', label: 'Luminous lavender' },
  luteal: { petals: ['#E3B3C6', '#C9A4C8', '#F0D3DE'], core: '#9A7097', glow: '#F4E6EE', label: 'Dusty pink & muted violet' },
  late: { petals: ['#E3B3C6', '#D2BFD9', '#F0D3DE'], core: '#8E7390', glow: '#F4E6EE', label: 'Waiting bloom' },
  unknown: { petals: ['#EBDDE6', '#E1D6EC', '#F5ECEF'], core: '#B5A0B8', glow: '#F7F1F4', label: 'Gentle bud' },
};

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 };
export const space = (n: number) => n * 4;

export const fonts = {
  serif: 'Fraunces_500Medium',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifBold: 'Fraunces_600SemiBold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
};
