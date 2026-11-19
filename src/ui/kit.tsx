/** Bausteine im Wir-Zwei-Look: ruhige Karten auf kühlem Grund, weicher Farbschleier in euren Farben. */
import { createContext, forwardRef, useContext, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type TextInputInstance, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { fonts, useTheme } from '@/theme';

/** Hintergrund: Farbschleier wie in der Web-App (blau oben links, rosa rechts, orange unten). */
export function Aurora() {
  const t = useTheme();
  const blobs = [
    { id: 'a', cx: '0%', cy: '0%', rx: '70%', ry: '50%', c: t.g1 },
    { id: 'b', cx: '100%', cy: '22%', rx: '60%', ry: '45%', c: t.g2 },
    { id: 'c', cx: '15%', cy: '62%', rx: '55%', ry: '40%', c: t.g4 },
    { id: 'd', cx: '90%', cy: '100%', rx: '70%', ry: '50%', c: t.g3 },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {blobs.map((b) => (
            <RadialGradient key={b.id} id={b.id} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fx={b.cx} fy={b.cy} gradientUnits="objectBoundingBox">
              <Stop offset="0" stopColor={b.c} stopOpacity={1} />
              <Stop offset="0.7" stopColor={b.c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((b) => <Rect key={b.id} x="0" y="0" width="100%" height="100%" fill={`url(#${b.id})`} />)}
      </Svg>
    </View>
  );
}

/** Etwas, das oben in jedem Screen darunter erscheinen soll (z. B. „Zurück“, wenn ein Bereich kein Tab ist). */
export const ScreenTop = createContext<ReactNode>(null);

export function Screen({ children, scroll = true, padTop = true }: { children: ReactNode; scroll?: boolean; padTop?: boolean }) {
  const insets = useSafeAreaInsets();
  const top = useContext(ScreenTop);
  const pad = { paddingTop: padTop ? insets.top + 14 : 14, paddingBottom: 32, paddingHorizontal: 16, gap: 18 };
  return (
    <View style={{ flex: 1 }}>
      <Aurora />
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, { maxWidth: 760, width: '100%', alignSelf: 'center' }]} keyboardShouldPersistTaps="handled">
          {top}
          {children}
        </ScrollView>
      ) : (
        <View style={[pad, { flex: 1 }]}>{top}{children}</View>
      )}
    </View>
  );
}

type V = 'display' | 'h2' | 'eyebrow' | 'body' | 'muted' | 'big' | 'small' | 'label';
export function T({ v = 'body', style, ...rest }: TextProps & { v?: V; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const base: Record<V, TextStyle> = {
    display: { fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 34, letterSpacing: -0.6, color: t.ink },
    h2: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.2, color: t.ink },
    big: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: t.ink },
    eyebrow: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: t.muted },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: t.ink },
    muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.muted },
    small: { fontFamily: fonts.body, fontSize: 13, color: t.muted },
    label: { fontFamily: fonts.bodySemi, fontSize: 13, color: t.muted },
  };
  return <Text {...rest} style={[base[v], style]} maxFontSizeMultiplier={1.6} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface, borderRadius: 18, padding: 16, gap: 12,
          shadowColor: t.shadow, shadowOpacity: t.dark ? 0.3 : 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <T v="h2">{title}</T>
      {action}
    </View>
  );
}

/** Drückt sich beim Antippen leicht ein (wie in der Web-App). */
export function Press({ style, scale = 0.96, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scale?: number }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }] }, rest.disabled && { opacity: 0.55 }]}
    />
  );
}

export function Button({
  title, onPress, kind = 'primary', icon, busy, disabled, small, testID,
}: {
  title: string; onPress?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'link';
  icon?: ReactNode; busy?: boolean; disabled?: boolean; small?: boolean; testID?: string;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.blue : kind === 'danger' ? t.red : kind === 'ghost' ? t.surface2 : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? t.onAccent : kind === 'link' ? t.blue : t.ink;
  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      scale={0.93}
      style={{
        backgroundColor: bg, borderRadius: small ? 10 : 12, paddingVertical: kind === 'link' ? 4 : small ? 7 : 12,
        paddingHorizontal: kind === 'link' ? 2 : small ? 12 : 16, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 6, minHeight: kind === 'link' ? undefined : small ? 34 : 46,
      }}>
      {busy ? <ActivityIndicator color={fg} /> : icon}
      <Text style={{ color: fg, fontFamily: fonts.bodySemi, fontSize: small || kind === 'link' ? 14 : 15 }}>{title}</Text>
    </Press>
  );
}

export const Input = forwardRef<TextInputInstance, TextInputProps & { label?: string; hint?: string }>(function Input(
  { label, hint, style, ...rest }, ref,
) {
  const t = useTheme();
  return (
    <View style={{ gap: 5 }}>
      {label ? <T v="label">{label}</T> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={t.muted}
        {...rest}
        style={[
          {
            borderWidth: 1.5, borderColor: t.line, backgroundColor: t.surface, borderRadius: 12,
            paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, minHeight: 46, color: t.ink, fontFamily: fonts.body,
          },
          rest.multiline && { minHeight: 90, textAlignVertical: 'top' },
          style,
        ]}
      />
      {hint ? <T v="small">{hint}</T> : null}
    </View>
  );
});

export function Banner({ children, warn }: { children: ReactNode; warn?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: warn ? t.redSoft : t.blueSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 }}>
      <T style={{ fontSize: 13.5, lineHeight: 19 }}>{children}</T>
    </View>
  );
}

export function DateBadge({ date, tone }: { date: Date; tone: { soft: string; ink: string } }) {
  const M = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return (
    <View style={{ width: 48, borderRadius: 12, backgroundColor: tone.soft, alignItems: 'center', paddingVertical: 5 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: tone.ink, lineHeight: 22 }}>{date.getDate()}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: tone.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>{M[date.getMonth()]}</Text>
    </View>
  );
}

export function Who({ name, color }: { name: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <T v="small" style={{ fontFamily: fonts.bodySemi }}>{name}</T>
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line }} />;
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Aurora />
      <ActivityIndicator color={t.blue} />
    </View>
  );
}

/** Umschalter wie in der Web-App (z. B. "Monat | Geburtstage"). */
export function Segmented<K extends string>({ value, options, onChange }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderRadius: 999, padding: 3, gap: 2, alignSelf: 'flex-start' }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Press
            key={o.key}
            onPress={() => onChange(o.key)}
            scale={0.9}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            testID={`seg-${o.key}`}
            style={[
              { paddingVertical: 7, paddingHorizontal: 15, borderRadius: 999 },
              on && { backgroundColor: t.surface, shadowColor: t.shadow, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
            ]}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? t.ink : t.muted }}>{o.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}
