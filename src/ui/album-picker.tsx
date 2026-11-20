/** Ein Foto aus eurem Album auswählen (waagerechte Reihe mit Vorschaubildern, erstes Feld = kein Foto). */
import { Image } from 'expo-image';
import { ScrollView } from 'react-native';

import { usePhotos } from '@/data/provider';
import { fonts, useTheme } from '@/theme';
import { Press, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';

export function AlbumPicker({ value, onChange, noneLabel = 'Kein Foto', testID = 'album-pick' }: {
  value: string | null; onChange: (id: string | null) => void; noneLabel?: string; testID?: string;
}) {
  const t = useTheme();
  const { items: all, loaded } = usePhotos();
  const items = all.filter((p) => p.album);
  const shown = items.slice(0, 40);
  const urls = usePhotoUrls(shown);
  const tile = { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' as const, borderWidth: 3 };
  if (loaded && !items.length) return <T v="small">Lege zuerst Fotos ins Album, dann kannst du hier eins auswählen.</T>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
      <Press onPress={() => onChange(null)} scale={0.94} accessibilityRole="radio" accessibilityLabel={noneLabel} accessibilityState={{ selected: !value }} testID={`${testID}-none`}
        style={[tile, { backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', borderColor: !value ? t.blue : 'transparent' }]}>
        <T style={{ fontFamily: fonts.bodySemi, fontSize: 12, textAlign: 'center' }}>{noneLabel}</T>
      </Press>
      {shown.map((p) => {
        const on = value === p.id;
        return (
          <Press key={p.id} onPress={() => onChange(p.id)} scale={0.94} accessibilityRole="radio" accessibilityLabel={p.caption ?? 'Foto'} accessibilityState={{ selected: on }} testID={testID}
            style={[tile, { backgroundColor: t.surface2, borderColor: on ? t.blue : 'transparent' }]}>
            {urls[p.id] ? <Image source={{ uri: urls[p.id], cacheKey: p.id }} style={{ width: '100%', height: '100%' }} contentFit="cover" recyclingKey={p.id} /> : null}
          </Press>
        );
      })}
    </ScrollView>
  );
}
