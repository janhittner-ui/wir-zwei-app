/** Listen: Einkauf und Notizen in einem Tab (Reiter oben), wie in der alten Web-App. */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { NotesList } from '@/ui/notes-list';
import { Screen, Segmented, T } from '@/ui/kit';
import { ShoppingList } from '@/ui/shopping-list';

type Seg = 'einkauf' | 'notizen';

export default function Listen() {
  const params = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg] = useState<Seg>(params.seg === 'notizen' ? 'notizen' : 'einkauf');
  useEffect(() => {
    if (params.seg === 'einkauf' || params.seg === 'notizen') setSeg(params.seg);
  }, [params.seg]);

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <View>
          <T v="eyebrow">{seg === 'einkauf' ? 'Was fehlt?' : 'Festgehalten'}</T>
          <T v="display">Listen</T>
        </View>
        <Segmented<Seg> value={seg} onChange={setSeg} options={[{ key: 'einkauf', label: 'Einkauf' }, { key: 'notizen', label: 'Notizen' }]} />
      </View>
      {seg === 'einkauf' ? <ShoppingList /> : <NotesList />}
    </Screen>
  );
}
