/** Zeile, die man wie in iOS-Mail nach links wischt, um "Löschen" zu zeigen. Ganz durchwischen löscht direkt. */
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { fonts, useTheme } from '@/theme';

export function SwipeToDelete({ children, onDelete, label = 'Löschen' }: { children: ReactNode; onDelete: () => void; label?: string }) {
  const t = useTheme();
  const renderRight = (_p: unknown, _tr: unknown, methods: SwipeableMethods) => (
    <Pressable
      onPress={() => {
        methods.close();
        onDelete();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ backgroundColor: t.red, justifyContent: 'center', alignItems: 'center', width: 88, borderRadius: 12, marginLeft: 8 }}>
      <Text style={{ color: '#FFFFFF', fontFamily: fonts.bodySemi, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <Swipeable
      friction={1.6}
      rightThreshold={44}
      overshootRight={false}
      renderRightActions={renderRight}
      containerStyle={{ overflow: 'visible' }}>
      {children}
    </Swipeable>
  );
}
