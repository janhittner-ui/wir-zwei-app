/** Listen: Einkauf, Notizen, Filme & Serien, Geschenke und Dates in einem Tab (Reiter oben), wie in der alten Web-App. */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { LIST_LABEL, LIST_SEGS, visible, type ListSeg } from '@/lib/prefs';
import { DatesList } from '@/ui/dates-list';
import { GiftsList } from '@/ui/gifts-list';
import { MediaList } from '@/ui/media-list';
import { NotesList } from '@/ui/notes-list';
import { Screen, Segmented, T } from '@/ui/kit';
import { ShoppingList } from '@/ui/shopping-list';

type Seg = ListSeg;
const isSeg = (s?: string): s is Seg => LIST_SEGS.includes(s as Seg);
const EYEBROW: Record<Seg, string> = {
  einkauf: 'Was fehlt?', notizen: 'Festgehalten', filme: 'Filme & Serien für den Sofaabend', geschenke: 'Geschenkideen und Wünsche', dates: 'Ideen für eure Zeit zu zweit',
};

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
          <T v="eyebrow">{EYEBROW[seg]}</T>
          <T v="display">Listen</T>
        </View>
        {segs.length > 1 ? <Segmented<Seg> fill={segs.length >= 4} value={seg} onChange={setSeg} options={segs.map((k) => ({ key: k, label: LIST_LABEL[k] }))} /> : null}
      </View>
      {seg === 'einkauf' ? <ShoppingList /> : seg === 'notizen' ? <NotesList /> : seg === 'filme' ? <MediaList /> : seg === 'dates' ? <DatesList /> : <GiftsList />}
    </Screen>
  );
}
