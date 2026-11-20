/**
 * Foto für ein Rezept oder Restaurant: großes Bild oder ein Feld „Foto hinzufügen“.
 * Ein Tipp öffnet das iPhone-Aktionsblatt: aufnehmen, aus Fotos wählen, aus dem Album wählen oder entfernen.
 * Neue Fotos werden verkleinert im privaten Speicher abgelegt, erscheinen aber NICHT im Album (album = false).
 * Damit keine verwaisten Fotos liegen bleiben, räumt useOwnPhotos() nach Speichern, Löschen oder Abbrechen auf.
 */
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Platform, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import type { DataStore } from '@/data/store';
import { useApp, usePhotos } from '@/data/provider';
import type { Photo } from '@/data/types';
import { pickPhotos, PickError, preparePhoto } from '@/lib/photo-pick';
import { fonts, useTheme } from '@/theme';
import { AlbumPicker } from '@/ui/album-picker';
import { IconPhoto } from '@/ui/icons';
import { Banner, Button, Press, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';

/**
 * Merkt sich, welche Fotos in diesem Formular neu hochgeladen wurden.
 * - Abbrechen: neue Uploads wieder löschen.
 * - Speichern/Löschen: das vorherige eigene Foto (nicht aus dem Album) und nicht genutzte Uploads löschen.
 */
export function useOwnPhotos() {
  const { store } = useApp();
  const { items: photos } = usePhotos();
  const uploaded = useRef(new Set<string>());
  const done = useRef(false);
  const storeRef = useRef<DataStore>(store);
  storeRef.current = store;
  useEffect(() => () => {
    if (!done.current) for (const id of uploaded.current) storeRef.current.deletePhoto(id).catch(() => undefined);
  }, []);
  const own = (id: string | null, list: Photo[]) => !!id && (uploaded.current.has(id) || list.some((p) => p.id === id && !p.album));
  return {
    onUploaded: (id: string) => void uploaded.current.add(id),
    /** nach erfolgreichem Speichern (keep = jetzt gespeichertes Foto) oder Löschen (keep = null) */
    cleanup: async (previous: string | null, keep: string | null) => {
      done.current = true;
      const drop = new Set(uploaded.current);
      if (own(previous, photos)) drop.add(previous!);
      if (keep) drop.delete(keep);
      for (const id of drop) await store.deletePhoto(id).catch(() => undefined);
    },
  };
}

export function DishPhotoField({ value, onChange, caption, title = 'Foto', onUploaded }: {
  value: string | null; onChange: (id: string | null) => void; caption: string; title?: string; onUploaded?: (id: string) => void;
}) {
  const t = useTheme();
  const { store } = useApp();
  const { items, setItems } = usePhotos();
  const photo = value ? items.find((p) => p.id === value) : undefined;
  const urls = usePhotoUrls(photo ? [photo] : []);
  const [busy, setBusy] = useState(false);
  const [album, setAlbum] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (source: 'library' | 'camera') => {
    setErr(null);
    try {
      const [asset] = await pickPhotos(source, 1);
      if (!asset) return;
      setBusy(true);
      const p = await store.addPhoto({ ...(await preparePhoto(asset)), caption: caption.trim().slice(0, 200) || null, album: false });
      onUploaded?.(p.id);
      setItems((l) => (l.some((x) => x.id === p.id) ? l : [p, ...l]));
      onChange(p.id);
      setAlbum(false);
    } catch (e) {
      setErr(e instanceof PickError ? e.message : friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    if (Platform.OS !== 'ios') return void upload('library');
    const options = ['Abbrechen', 'Foto aufnehmen', 'Aus Fotos auswählen', 'Aus eurem Album', ...(value ? ['Foto entfernen'] : [])];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: 0, destructiveButtonIndex: value ? 4 : undefined, title },
      (i) => {
        if (i === 1) upload('camera');
        else if (i === 2) upload('library');
        else if (i === 3) setAlbum(true);
        else if (i === 4) onChange(null);
      },
    );
  };

  const url = photo ? urls[photo.id] : undefined;
  return (
    <View style={{ gap: 8 }}>
      <T v="label">Foto (optional)</T>
      {value ? (
        <Press onPress={open} scale={0.98} accessibilityRole="button" accessibilityLabel="Foto ändern" testID="recipe-photo"
          style={{ aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden', backgroundColor: t.surface2 }}>
          {url ? <Image source={{ uri: url, cacheKey: value }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} recyclingKey={value} /> : null}
          <View style={{ position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <T style={{ color: '#fff', fontFamily: fonts.bodySemi, fontSize: 13 }}>Ändern</T>
          </View>
        </Press>
      ) : (
        <Press onPress={open} scale={0.98} accessibilityRole="button" accessibilityLabel="Foto hinzufügen" testID="recipe-photo-add"
          style={{ height: 120, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <IconPhoto color={t.blue} size={26} />
          <T style={{ color: t.blue, fontFamily: fonts.bodySemi }}>{busy ? 'Lade hoch …' : 'Foto hinzufügen'}</T>
        </Press>
      )}
      {album ? (
        <View style={{ gap: 6 }}>
          <AlbumPicker value={value} onChange={(id) => onChange(id)} testID="recipe-album" />
          <Button small kind="link" title="Fertig" onPress={() => setAlbum(false)} />
        </View>
      ) : null}
      {busy && value ? <Banner>Lade hoch …</Banner> : null}
      {err ? <Banner warn>{err}</Banner> : null}
    </View>
  );
}
