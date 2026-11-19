/** Holt die (zeitlich begrenzten) Anzeige-Links für Fotos; fehlende Links bleiben einfach leer. */
import { useEffect, useState } from 'react';

import { useApp } from '@/data/provider';
import type { Photo } from '@/data/types';

export function usePhotoUrls(photos: Photo[]) {
  const { store } = useApp();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = photos.map((p) => p.id).join(',');
  useEffect(() => {
    let alive = true;
    if (!photos.length) return;
    store.photoUrls(photos)
      .then((u) => alive && setUrls((old) => ({ ...old, ...u })))
      .catch((e) => console.warn('Foto-Links laden fehlgeschlagen', e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key]);
  return urls;
}
