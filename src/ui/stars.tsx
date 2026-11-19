/** Sterne-Bewertung 1–5. Mit onChange antippbar (gleichen Stern nochmal = Bewertung weg). */
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { IconStar } from '@/ui/icons';
import { Press } from '@/ui/kit';

export function Stars({ value, onChange, size = 16, testID }: { value: number | null; onChange?: (n: number | null) => void; size?: number; testID?: string }) {
  const t = useTheme();
  const v = value ?? 0;
  if (!onChange) {
    return (
      <View style={{ flexDirection: 'row', gap: 1 }} accessible accessibilityLabel={`${v} von 5 Sternen`}>
        {[1, 2, 3, 4, 5].map((n) => <IconStar key={n} color={n <= v ? t.yellow : t.lineStrong} filled={n <= v} size={size} />)}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole="adjustable" accessibilityLabel="Bewertung" accessibilityValue={{ text: `${v} von 5 Sternen` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(5, Math.max(0, v + (e.nativeEvent.actionName === 'increment' ? 1 : -1))) || null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Press key={n} onPress={() => onChange(n === v ? null : n)} scale={0.8} hitSlop={4} testID={testID ? `${testID}-${n}` : undefined} style={{ padding: 3 }}>
          <IconStar color={n <= v ? t.yellow : t.lineStrong} filled={n <= v} size={size} />
        </Press>
      ))}
    </View>
  );
}
