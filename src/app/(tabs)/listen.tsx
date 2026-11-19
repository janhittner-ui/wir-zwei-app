/** Listen: Einkauf, Notizen, Filme & Serien und Geschenke in einem Tab (Reiter oben), wie in der alten Web-App. */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GiftsList } from '@/ui/gifts-list';
import { MediaList } from '@/ui/media-list';
import { NotesList } from '@/ui/notes-list';
import { Screen, Segmented, T } from '@/ui/kit';
import { ShoppingList } from '@/ui/shopping-list';

type Seg = 'einkauf' | 'notizen' | 'filme' | 'geschenke';
const SEGS: Seg[] = ['einkauf', 'notizen', 'filme', 'geschenke'];
const isSeg = (s?: string): s is Seg => SEGS.includes(s as Seg);

export default function Listen() {
  const params = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg] = useState<Seg>(isSeg(params.seg) ? params.seg : 'einkauf');
  useEffect(() => {
    if (isSeg(params.seg)) setSeg(params.seg);
  }, [params.seg]);

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <View>
          <T v="eyebrow">{seg === 'einkauf' ? 'Was fehlt?' : seg === 'notizen' ? 'Festgehalten' : seg === 'filme' ? 'Filme & Serien für den Sofaabend' : 'Geschenkideen und Wünsche'}</T>
          <T v="display">Listen</T>
        </View>
        <Segmented<Seg> value={seg} onChange={setSeg} options={[{ key: 'einkauf', label: 'Einkauf' }, { key: 'notizen', label: 'Notizen' }, { key: 'filme', label: 'Filme' }, { key: 'geschenke', label: 'Geschenke' }]} />
      </View>
      {seg === 'einkauf' ? <ShoppingList /> : seg === 'notizen' ? <NotesList /> : seg === 'filme' ? <MediaList /> : <GiftsList />}
    </Screen>
  );
}
