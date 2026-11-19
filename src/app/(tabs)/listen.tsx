/** Listen: Einkauf, Notizen, Filme & Serien und Geschenke in einem Tab (Reiter oben), wie in der alten Web-App. */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { LIST_LABEL, LIST_SEGS, visible, type ListSeg } from '@/lib/prefs';
import { GiftsList } from '@/ui/gifts-list';
import { MediaList } from '@/ui/media-list';
import { NotesList } from '@/ui/notes-list';
import { Screen, Segmented, T } from '@/ui/kit';
import { ShoppingList } from '@/ui/shopping-list';

type Seg = ListSeg;
const isSeg = (s?: string): s is Seg => LIST_SEGS.includes(s as Seg);

export default function Listen() {
  const params = useLocalSearchParams<{ seg?: string }>();
  const { prefs } = usePrefs();
  // Reiter und Reihenfolge aus „Anpassen“; ein direkt angesprungener Reiter erscheint auch, wenn er ausgeblendet ist
  const shown = visible(prefs.lists);
  const [picked, setSeg] = useState<Seg>(isSeg(params.seg) ? params.seg : shown[0]);
  useEffect(() => {
    if (isSeg(params.seg)) setSeg(params.seg);
  }, [params.seg]);
  const segs = shown.includes(picked) ? shown : picked === params.seg ? [...shown, picked] : shown;
  const seg = segs.includes(picked) ? picked : segs[0];

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <View>
          <T v="eyebrow">{seg === 'einkauf' ? 'Was fehlt?' : seg === 'notizen' ? 'Festgehalten' : seg === 'filme' ? 'Filme & Serien für den Sofaabend' : 'Geschenkideen und Wünsche'}</T>
          <T v="display">Listen</T>
        </View>
        {segs.length > 1 ? <Segmented<Seg> value={seg} onChange={setSeg} options={segs.map((k) => ({ key: k, label: LIST_LABEL[k] }))} /> : null}
      </View>
      {seg === 'einkauf' ? <ShoppingList /> : seg === 'notizen' ? <NotesList /> : seg === 'filme' ? <MediaList /> : <GiftsList />}
    </Screen>
  );
}
