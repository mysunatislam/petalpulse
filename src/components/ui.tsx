import React from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useTarget, useTextScale, useTheme } from '../theme/useTheme';
import { BANGLA_FONT, fonts, hasBangla, radius } from '../theme/tokens';
import { useApp } from '../store/app';
import { localize, localizeNode } from '../i18n';

export function tap(kind: 'light' | 'success' | 'select' = 'light') {
  if (!useApp.getState().settings.haptics) return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'select') Haptics.selectionAsync();
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // haptics unavailable (web)
  }
}

/** Tells a screen reader what just happened (e.g. "Saved"), in the app's language. */
export function announce(message: string) {
  try {
    AccessibilityInfo.announceForAccessibility(localize(useApp.getState().settings.language, message));
  } catch {
    // no screen reader API (tests)
  }
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyMedium' | 'small' | 'label' | 'eyebrow' | 'serifItalic';

const VARIANT: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.serif, fontSize: 23, lineHeight: 29 },
  h3: { fontFamily: fonts.sansSemi, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.sansMedium, fontSize: 15.5, lineHeight: 23 },
  small: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 18 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11.5, lineHeight: 15, letterSpacing: 1.4, textTransform: 'uppercase' },
  serifItalic: { fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 25 },
};

export function T({
  v = 'body',
  muted,
  soft,
  color,
  center,
  style,
  ...rest
}: TextProps & { v?: Variant; muted?: boolean; soft?: boolean; color?: string; center?: boolean }) {
  const t = useTheme();
  const scale = useTextScale();
  const lang = useApp((st) => st.settings.language);
  const children = localizeNode(lang, rest.children);
  const flat = StyleSheet.flatten([VARIANT[v], style]) ?? {};
  const fontSize = (flat.fontSize ?? 15) * scale;
  const sized = scale !== 1 ? { fontSize, lineHeight: flat.lineHeight ? flat.lineHeight * scale : undefined } : null;
  // Bengali script needs more vertical room for its vowel signs, and no letter-spacing or uppercase.
  const bangla = hasBangla(children)
    ? { fontFamily: BANGLA_FONT[flat.fontFamily as string] ?? fonts.bn, lineHeight: Math.round(fontSize * 1.6), letterSpacing: 0, textTransform: 'none' as const }
    : null;
  return (
    <Text
      maxFontSizeMultiplier={1.8}
      {...rest}
      style={[VARIANT[v], { color: color ?? (muted ? t.textMuted : soft ? t.textSoft : t.text) }, center && { textAlign: 'center' }, style, sized, bangla]}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Screen({
  children,
  title,
  eyebrow,
  back = true,
  scroll = true,
  right,
  edges = ['top'],
  contentStyle,
  calm,
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  back?: boolean;
  scroll?: boolean;
  right?: React.ReactNode;
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
  calm?: boolean;
}) {
  const t = useTheme();
  const isDemo = useApp((s) => s.profile.isDemo);
  const header = (title || back) && (
    <View style={styles.header}>
      {back ? (
        <IconButton label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 5l-7 7 7 7" stroke={t.text} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconButton>
      ) : (
        <View style={{ width: 4 }} />
      )}
      <View style={{ flex: 1, paddingHorizontal: 8 }}>
        {eyebrow ? <T v="eyebrow" soft>{eyebrow}</T> : null}
        {title ? (
          <T v="h2" accessibilityRole="header" numberOfLines={2}>
            {title}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
  const body = (
    <>
      {isDemo && <DemoBanner />}
      {header}
      {children}
    </>
  );
  return (
    <LinearGradient colors={calm ? [t.bg, t.bg, t.bgAlt] : t.gradient} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView edges={edges} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{body}</View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

export function DemoBanner() {
  const t = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Demo mode. Showing synthetic sample data for a fictional user."
      style={[styles.demo, { backgroundColor: t.lavender, borderColor: t.border }]}
    >
      <T v="small" style={{ fontFamily: fonts.sansMedium }}>
        ✿ Demo mode · synthetic data for a fictional user
      </T>
    </View>
  );
}

export function Card({
  children,
  style,
  glass,
  tint,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glass?: boolean;
  tint?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: tint ?? (glass ? t.surfaceGlass : t.surface),
    borderColor: t.border,
    shadowColor: t.shadow,
    ...(t.hc && { borderWidth: 1.5 }),
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.card, base, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, base, style]}>{children}</View>;
}

export function Row({ style, ...p }: ViewProps) {
  return <View {...p} style={[{ flexDirection: 'row', alignItems: 'center' }, style]} />;
}

export function Gap({ h = 12, w }: { h?: number; w?: number }) {
  return <View style={{ height: w ? undefined : h, width: w }} />;
}

export function SectionTitle({ children, action, onAction }: { children: React.ReactNode; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
      <T v="h2" accessibilityRole="header">
        {children}
      </T>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={10}>
          <T v="label" color={t.primaryText}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </Row>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  icon,
  style,
  accessibilityHint,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  small?: boolean;
}) {
  const t = useTheme();
  const bg =
    kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : kind === 'soft' ? t.blush : kind === 'secondary' ? t.surface : 'transparent';
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? '#fff' : t.text;
  const minHeight = useTarget(small ? 42 : 54);
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { minHeight, backgroundColor: bg, borderColor: kind === 'secondary' || kind === 'ghost' || t.hc ? t.border : 'transparent', opacity: disabled ? 0.45 : 1 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <T maxFontSizeMultiplier={1.6} style={[small ? VARIANT.label : VARIANT.bodyMedium, { textAlign: 'center' }]} color={fg}>
          {icon ? `${icon}  ` : ''}
          {title}
        </T>
      )}
    </Pressable>
  );
}

export function IconButton({ children, label, onPress, style }: { children: React.ReactNode; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const size = useTarget(44);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.surfaceGlass, borderColor: t.border }, pressed && { opacity: 0.7 }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const minHeight = useTarget(40);
  return (
    <Pressable
      onPress={() => {
        tap('select');
        onPress?.();
      }}
      accessibilityRole={onPress ? 'checkbox' : 'text'}
      accessibilityState={onPress ? { checked: !!selected } : undefined}
      accessibilityLabel={localize(useApp.getState().settings.language, label)}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight,
          backgroundColor: selected ? color ?? t.accent : t.surfaceGlass,
          borderColor: selected ? (t.hc ? t.text : 'transparent') : t.border,
          ...(t.hc && { borderWidth: selected ? 2 : 1.5 }),
        },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <T maxFontSizeMultiplier={1.6} style={VARIANT.label} color={selected ? (color ? t.text : t.accentText) : t.text}>
        {selected && t.hc && !icon ? '✓ ' : ''}
        {icon ? `${icon} ` : ''}
        {label}
      </T>
    </Pressable>
  );
}

export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  multi,
  color,
}: {
  options: { value: V; label: string; icon?: string }[];
  value: V | V[] | null;
  onChange: (v: V | V[]) => void;
  multi?: boolean;
  color?: string;
}) {
  const sel = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          icon={o.icon}
          selected={sel(o.value)}
          color={color}
          onPress={() => {
            if (multi) {
              const arr = Array.isArray(value) ? value : [];
              onChange(arr.includes(o.value) ? arr.filter((x) => x !== o.value) : [...arr, o.value]);
            } else onChange(o.value);
          }}
        />
      ))}
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const t = useTheme();
  const minHeight = useTarget(38);
  return (
    <View style={[styles.segment, { backgroundColor: t.surfaceGlass, borderColor: t.border }, t.hc && { borderWidth: 1.5 }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap('select');
              onChange(o.value);
            }}
            style={[styles.segItem, { minHeight }, on && { backgroundColor: t.accent }]}
          >
            <T maxFontSizeMultiplier={1.5} style={[VARIANT.label, { textAlign: 'center' }]} color={on ? t.accentText : t.textMuted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={localize(useApp.getState().settings.language, label)}
      accessibilityHint={detail}
      onPress={() => {
        tap('select');
        onChange(!value);
      }}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T v="bodyMedium">{label}</T>
        {detail ? (
          <T v="small" muted style={{ marginTop: 2 }}>
            {detail}
          </T>
        ) : null}
      </View>
      {t.hc ? (
        <T v="label" style={{ marginRight: 8 }}>
          {value ? 'On' : 'Off'}
        </T>
      ) : null}
      <View style={[styles.track, { backgroundColor: value ? t.primary : t.border }]}>
        <View style={[styles.thumb, { transform: [{ translateX: value ? 20 : 0 }], backgroundColor: t.hc && t.dark ? '#000' : '#fff' }]} />
      </View>
    </Pressable>
  );
}

export function Stepper({ value, onChange, min, max, step = 1, format, label }: { value: number | null; onChange: (v: number | null) => void; min: number; max: number; step?: number; format?: (v: number) => string; label: string }) {
  const t = useTheme();
  const v = value ?? Math.round((min + max) / 2);
  return (
    <Row style={{ gap: 12 }} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: value === null ? 'Not set' : format ? format(v) : String(v) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.max(min, Math.min(max, v + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
    >
      <IconButton label={`Decrease ${label}`} onPress={() => onChange(Math.max(min, v - step))}>
        <T v="h3">−</T>
      </IconButton>
      <View style={[styles.stepVal, { backgroundColor: t.surfaceGlass, borderColor: t.border }]}>
        <T v="h3" center>
          {value === null ? '—' : format ? format(v) : v}
        </T>
      </View>
      <IconButton label={`Increase ${label}`} onPress={() => onChange(Math.min(max, v + step))}>
        <T v="h3">+</T>
      </IconButton>
    </Row>
  );
}

export function Notice({ tone = 'info', title, children, action, onAction }: { tone?: 'info' | 'warn' | 'danger' | 'calm'; title?: string; children: React.ReactNode; action?: string; onAction?: () => void }) {
  const t = useTheme();
  const bg = tone === 'danger' ? t.dangerBg : tone === 'warn' ? t.warnBg : tone === 'calm' ? t.sage : t.lavender;
  const fg = tone === 'danger' ? t.danger : tone === 'warn' ? t.warn : t.text;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      {title ? (
        <T v="h3" color={fg} style={{ marginBottom: 4 }}>
          {title}
        </T>
      ) : null}
      {typeof children === 'string' ? <T v="small" color={tone === 'danger' ? fg : t.text}>{children}</T> : children}
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={{ marginTop: 8 }}>
          <T v="label" color={tone === 'danger' ? fg : t.primaryText} style={{ textDecorationLine: 'underline' }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({ children, color, textColor }: { children: React.ReactNode; color?: string; textColor?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: color ?? t.blush }]}>
      <T v="small" color={textColor} style={{ fontFamily: fonts.sansMedium }}>
        {children}
      </T>
    </View>
  );
}

export function ListItem({ title, detail, onPress, icon, right }: { title: string; detail?: string; onPress?: () => void; icon?: string; right?: React.ReactNode } & Pick<PressableProps, 'accessibilityHint'>) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listItem, { borderColor: t.border }, pressed && { opacity: 0.7 }]}
    >
      {icon ? <T style={{ fontSize: 20, marginRight: 12 }}>{icon}</T> : null}
      <View style={{ flex: 1 }}>
        <T v="bodyMedium">{title}</T>
        {detail ? (
          <T v="small" muted>
            {detail}
          </T>
        ) : null}
      </View>
      {right ?? (onPress ? <T v="h3" soft>›</T> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  card: {
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 2,
  },
  btn: {
    minHeight: 54,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnSmall: { minHeight: 42, paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, borderWidth: StyleSheet.hairlineWidth },
  segItem: { flex: 1, minHeight: 38, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 56 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 4 },
  thumb: { width: 20, height: 20, borderRadius: 10 },
  stepVal: { minWidth: 84, height: 44, borderRadius: 22, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  notice: { borderRadius: radius.md, padding: 16 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  demo: { marginTop: 6, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
});
