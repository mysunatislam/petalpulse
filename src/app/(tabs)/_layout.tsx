import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useT, StringKey } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { T, tap } from '../../components/ui';

const ICONS: Record<string, (c: string) => React.ReactNode> = {
  index: (c) => <Path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round" />,
  cycle: (c) => (
    <>
      <Circle cx={12} cy={12} r={8} stroke={c} strokeWidth={1.8} fill="none" />
      <Path d="M12 4a8 8 0 0 1 7.7 6" stroke={c} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={12} cy={12} r={2} fill={c} />
    </>
  ),
  care: (c) => <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round" />,
  insights: (c) => <Path d="M12 20c0-6 0-9 0-12M12 12c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5zM8 20h8" stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  petal: (c) => <Path d="M5 17V9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H9l-4 3zM9 11h.01M12 11h.01M15 11h.01" stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
};

const LABEL: Record<string, StringKey> = { index: 'nav.home', cycle: 'nav.cycle', care: 'nav.care', insights: 'nav.insights', petal: 'nav.petal' };

function PetalTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: t.dark ? 'rgba(44,33,48,0.96)' : 'rgba(255,255,255,0.95)', borderColor: t.border, shadowColor: t.shadow }]} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const color = focused ? t.accentText : t.textMuted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tr(LABEL[route.name])}
              onPress={() => {
                tap('select');
                if (!focused) navigateToTab(route.key);
              }}
              style={styles.item}
            >
              <View style={[styles.iconPill, focused && { backgroundColor: t.accent }]}>
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  {ICONS[route.name]?.(color)}
                </Svg>
              </View>
              <T v="small" numberOfLines={1} style={{ fontSize: 10.5, marginTop: 2 }} color={focused ? t.text : t.textMuted} maxFontSizeMultiplier={1.3}>
                {tr(LABEL[route.name])}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <PetalTabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cycle" />
      <Tabs.Screen name="care" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="petal" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: {
    flexDirection: 'row',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 10,
  },
  item: { flex: 1, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  iconPill: { width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
