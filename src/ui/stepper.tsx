/** Plus/Minus-Schalter wie der iOS-Stepper (z. B. für Portionen). */
import { Text, View } from 'react-native';

import { fonts, useTheme } from '@/theme';
import { IconMinus, IconPlus } from '@/ui/icons';
import { Press } from '@/ui/kit';

export function Stepper({ value, onChange, min = 1, max = 99, label, testID }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; label: string; testID?: string;
}) {
  const t = useTheme();
  const btn = (dir: -1 | 1) => {
    const next = value + dir;
    const off = next < min || next > max;
    return (
      <Press
        onPress={() => !off && onChange(next)}
        disabled={off}
        scale={0.85}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? 'Weniger' : 'Mehr'}
        testID={testID ? `${testID}-${dir < 0 ? 'minus' : 'plus'}` : undefined}
        style={{ width: 44, height: 34, alignItems: 'center', justifyContent: 'center' }}>
        {dir < 0 ? <IconMinus color={t.ink} size={18} /> : <IconPlus color={t.ink} size={18} />}
      </Press>
    );
  };
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface2, borderRadius: 9 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const n = value + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
        if (n >= min && n <= max) onChange(n);
      }}>
      {btn(-1)}
      <Text style={{ minWidth: 28, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 16, color: t.ink }} testID={testID}>{value}</Text>
      {btn(1)}
    </View>
  );
}
