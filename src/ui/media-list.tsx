/** Filme & Serien (Reiter im Tab „Listen“): gemeinsame Watchlist, abhaken wenn gesehen, bewerten. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useMedia } from '@/data/provider';
import type { Media, MediaKind } from '@/data/types';
import { fonts, personColors, useTheme } from '@/theme';
import { IconCheck, IconPlus, IconRight } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Press, Segmented, T } from '@/ui/kit';
import { Stars } from '@/ui/stars';
import { SwipeToDelete } from '@/ui/swipe-row';

type Filter = 'alle' | MediaKind;

export function MediaList() {
  const t = useTheme();
  const { store, couple } = useApp();
  const { items, setItems, loaded, error, reload } = useMedia();
  const [filter, setFilter] = useState<Filter>('alle');
  const [err, setErr] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const shown = useMemo(() => items.filter((m) => filter === 'alle' || m.kind === filter), [items, filter]);
  const open = shown.filter((m) => !m.done);
  const done = shown.filter((m) => m.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const act = async (optimistic: (l: Media[]) => Media[], fn: () => Promise<unknown>) => {
    setErr(null);
    setItems(optimistic);
    try {
      await fn();
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    }
  };
  const toggle = (m: Media) =>
    act((l) => l.map((x) => (x.id === m.id ? { ...x, done: !x.done, rating: x.done ? null : x.rating, doneAt: x.done ? null : new Date().toISOString() } : x)), () => store.setMediaDone(m.id, !m.done));
  const remove = (m: Media) => act((l) => l.filter((x) => x.id !== m.id), () => store.deleteMedia(m.id));
  const rate = (m: Media, rating: number | null) =>
    act((l) => l.map((x) => (x.id === m.id ? { ...x, rating } : x)), () => store.updateMedia(m.id, { title: m.title, kind: m.kind, platform: m.platform, note: m.note, rating }));
  const dot = (uid: string | null) => personColors(t, couple?.members.find((x) => x.id === uid)?.color).dot;
  const add = () => router.push({ pathname: '/film', params: filter === 'serie' ? { kind: 'serie' } : {} });

  if (loaded && !items.length) {
    return (
      <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
        {error ? <Banner warn>Die Liste konnte gerade nicht geladen werden.</Banner> : null}
        <T v="muted" style={{ textAlign: 'center' }}>
          Sammelt hier Filme und Serien, die ihr zusammen sehen wollt. Was ihr gesehen habt, hakt ihr ab und bewertet es.
        </T>
        <Button small title="Ersten Film eintragen" onPress={add} testID="add-media-empty" />
      </View>
    );
  }

  return (
    <>
      {error ? <Banner warn>Die Liste konnte gerade nicht geladen werden.</Banner> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Segmented<Filter> value={filter} onChange={setFilter} options={[{ key: 'alle', label: 'Alle' }, { key: 'film', label: 'Filme' }, { key: 'serie', label: 'Serien' }]} />
        <Button small title="Neu" icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} testID="add-media" />
      </View>
      {err ? <Banner warn>{err}</Banner> : null}
      <Card style={{ gap: 4 }}>
        <CardHead title="Wollen wir sehen" />
        {open.length ? (
          <>
            {open.map((m, i) => <MediaRow key={m.id} m={m} first={i === 0} dot={dot(m.createdBy)} onToggle={toggle} onDelete={remove} />)}
            <T v="small" style={{ textAlign: 'center', paddingTop: 6 }}>Zum Löschen nach links wischen</T>
          </>
        ) : (
          <T v="muted" style={{ paddingVertical: 8 }}>Alles gesehen. Zeit für Neues!</T>
        )}
      </Card>
      {done.length ? (
        <Card style={{ gap: 4 }}>
          <CardHead title={`Gesehen (${done.length})`} action={<Button kind="link" title={showDone ? 'Ausblenden' : 'Anzeigen'} onPress={() => setShowDone((v) => !v)} testID="media-show-done" />} />
          {showDone ? done.map((m, i) => <MediaRow key={m.id} m={m} first={i === 0} dot={dot(m.createdBy)} onToggle={toggle} onDelete={remove} onRate={rate} />) : null}
        </Card>
      ) : null}
    </>
  );
}

function MediaRow({ m, first, dot, onToggle, onDelete, onRate }: {
  m: Media; first: boolean; dot: string; onToggle: (m: Media) => void; onDelete: (m: Media) => void; onRate?: (m: Media, r: number | null) => void;
}) {
  const t = useTheme();
  const sub = [m.kind === 'serie' ? 'Serie' : 'Film', m.platform].filter(Boolean).join(' · ');
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: t.line, paddingTop: first ? 0 : 6 }}>
      <SwipeToDelete onDelete={() => onDelete(m)}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, paddingVertical: 4 }}
          accessible
          accessibilityLabel={`${m.title}, ${sub}${m.done ? ', gesehen' : ''}${m.rating ? `, ${m.rating} Sterne` : ''}`}
          accessibilityActions={[{ name: 'activate', label: m.done ? 'Nicht gesehen' : 'Gesehen' }, { name: 'delete', label: 'Löschen' }, { name: 'edit', label: 'Bearbeiten' }]}
          onAccessibilityAction={(e) => {
            const a = e.nativeEvent.actionName;
            if (a === 'delete') onDelete(m);
            else if (a === 'edit') router.push({ pathname: '/film', params: { id: m.id } });
            else onToggle(m);
          }}>
          <Press
            onPress={() => onToggle(m)}
            scale={0.82}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityLabel={m.title}
            accessibilityState={{ checked: m.done }}
            style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: m.done ? t.blue : t.lineStrong, backgroundColor: m.done ? t.blue : 'transparent' }}>
            {m.done ? <IconCheck color={t.onAccent} size={14} /> : null}
          </Press>
          <Text style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{m.kind === 'serie' ? '📺' : '🎬'}</Text>
          <Press onPress={() => router.push({ pathname: '/film', params: { id: m.id } })} scale={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontFamily: fonts.bodySemi }} numberOfLines={2}>{m.title}</T>
              <T v="small" numberOfLines={1}>{sub}</T>
              {m.done && onRate ? <Stars value={m.rating} onChange={(r) => onRate(m, r)} size={18} /> : null}
            </View>
            {!m.done ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} /> : null}
            <IconRight color={t.lineStrong} size={14} />
          </Press>
        </View>
      </SwipeToDelete>
    </View>
  );
}
