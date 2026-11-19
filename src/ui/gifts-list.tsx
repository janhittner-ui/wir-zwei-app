/**
 * Geschenke (Reiter im Tab „Listen“): Ideen nach Person und Wünsche.
 * Ideen für den Partner sieht nur, wer sie angelegt hat (die Datenbank liefert sie dem Partner gar nicht aus).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useGifts } from '@/data/provider';
import type { Gift } from '@/data/types';
import { fonts, personColors, useTheme } from '@/theme';
import { IconCheck, IconPlus, IconRight } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Press, Segmented, T } from '@/ui/kit';
import { SwipeToDelete } from '@/ui/swipe-row';

type Seg = 'ideen' | 'wuensche';

const host = (link: string | null) => {
  if (!link) return null;
  const m = link.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
  return m ? m[1] : null;
};

export function GiftsList() {
  const t = useTheme();
  const { store, couple, profile } = useApp();
  const { items, setItems, loaded, error, reload } = useGifts();
  const [seg, setSeg] = useState<Seg>('ideen');
  const [err, setErr] = useState<string | null>(null);
  const me = profile?.id;
  const partner = couple?.members.find((m) => m.id !== me);

  const ideas = items.filter((g) => g.kind === 'idea');
  const groups = useMemo(() => {
    const out: { key: string; title: string; hint?: string; forUser?: string; forName?: string; list: Gift[] }[] = [];
    const sort = (l: Gift[]) => [...l].sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));
    if (partner) {
      const l = ideas.filter((g) => g.forUser === partner.id);
      out.push({ key: 'partner', title: `Für ${partner.displayName}`, hint: `${partner.displayName} sieht diese Ideen nicht.`, forUser: partner.id, list: sort(l) });
    }
    const names = [...new Set(ideas.filter((g) => g.forName).map((g) => g.forName!))].sort((a, b) => a.localeCompare(b, 'de'));
    for (const n of names) out.push({ key: `n-${n}`, title: `Für ${n}`, forName: n, list: sort(ideas.filter((g) => g.forName === n)) });
    return out;
  }, [ideas, partner]);
  const myWishes = items.filter((g) => g.kind === 'wish' && g.createdBy === me);
  const theirWishes = items.filter((g) => g.kind === 'wish' && g.createdBy !== me);
  const handledWish = new Set(ideas.map((g) => g.wishId).filter(Boolean));

  const act = async (optimistic: (l: Gift[]) => Gift[], fn: () => Promise<unknown>) => {
    setErr(null);
    setItems(optimistic);
    try {
      await fn();
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    }
  };
  const toggle = (g: Gift) => act((l) => l.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)), () => store.setGiftDone(g.id, !g.done));
  const remove = (g: Gift) => act((l) => l.filter((x) => x.id !== g.id), () => store.deleteGift(g.id));
  const takeOver = async (w: Gift) => {
    if (!partner) return;
    setErr(null);
    try {
      const g = await store.addGift({ kind: 'idea', title: w.title, forUser: partner.id, forName: null, occasion: null, link: w.link, note: w.note, wishId: w.id });
      setItems((l) => (l.some((x) => x.id === g.id) ? l : [...l, g]));
    } catch (e) {
      setErr(friendlyError(e));
    }
  };
  const open = (g: Gift) => router.push({ pathname: '/geschenk', params: { id: g.id } });
  const addIdea = (p: { forUser?: string; forName?: string } = {}) => router.push({ pathname: '/geschenk', params: { kind: 'idea', ...p } });
  const addWish = () => router.push({ pathname: '/geschenk', params: { kind: 'wish' } });

  return (
    <>
      {error ? <Banner warn>Die Geschenke konnten gerade nicht geladen werden.</Banner> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Segmented<Seg> value={seg} onChange={setSeg} options={[{ key: 'ideen', label: 'Ideen' }, { key: 'wuensche', label: 'Wünsche' }]} />
        <Button small title={seg === 'ideen' ? 'Idee' : 'Wunsch'} icon={<IconPlus color={t.onAccent} size={18} />} onPress={() => (seg === 'ideen' ? addIdea() : addWish())} testID="add-gift" />
      </View>
      {err ? <Banner warn>{err}</Banner> : null}

      {seg === 'ideen' ? (
        groups.length && (groups.some((g) => g.list.length) || partner) ? (
          groups.map((g) => (
            <Card key={g.key} style={{ gap: 4 }}>
              <CardHead title={g.title} action={<Button kind="link" title="Hinzufügen" onPress={() => addIdea(g.forUser ? { forUser: g.forUser } : { forName: g.forName })} />} />
              {g.hint ? <T v="small" style={{ marginTop: -2, marginBottom: 4 }}>🔒 {g.hint}</T> : null}
              {g.list.length ? (
                g.list.map((x, i) => <GiftRow key={x.id} g={x} first={i === 0} onToggle={toggle} onDelete={remove} onOpen={open} />)
              ) : (
                <T v="muted" style={{ paddingVertical: 6 }}>Noch keine Idee. Wenn dir etwas einfällt, schreib es gleich auf.</T>
              )}
            </Card>
          ))
        ) : loaded ? (
          <Empty text="Notiert Geschenkideen für Familie und Freunde, sobald sie euch einfallen. Ideen für deinen Schatz bleiben vor ihm geheim." action="Erste Idee" onPress={() => addIdea()} />
        ) : null
      ) : (
        <>
          <Card style={{ gap: 4 }}>
            <CardHead title="Meine Wünsche" />
            {partner ? <T v="small" style={{ marginTop: -2, marginBottom: 4 }}>{partner.displayName} sieht deine Wünsche, aber nicht, ob jemand sie schon besorgt.</T> : null}
            {myWishes.length ? (
              myWishes.map((x, i) => <GiftRow key={x.id} g={x} first={i === 0} onDelete={remove} onOpen={open} />)
            ) : (
              <T v="muted" style={{ paddingVertical: 6 }}>Was wünschst du dir? Ein Link zum Produkt hilft beim Besorgen.</T>
            )}
          </Card>
          {partner ? (
            <Card style={{ gap: 4 }}>
              <CardHead title={`Wünsche von ${partner.displayName}`} />
              {theirWishes.length ? (
                theirWishes.map((w, i) => (
                  <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
                    <Press onPress={() => open(w)} style={{ flex: 1, gap: 2 }} accessibilityRole="button">
                      <T style={{ fontFamily: fonts.bodySemi }}>{w.title}</T>
                      {host(w.link) || w.note ? <T v="small" numberOfLines={1}>{[host(w.link), w.note].filter(Boolean).join(' · ')}</T> : null}
                    </Press>
                    {handledWish.has(w.id) ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel="Besorgst du">
                        <IconCheck color={t.green} size={14} />
                        <T v="small" style={{ color: t.green, fontFamily: fonts.bodySemi }}>Besorgst du</T>
                      </View>
                    ) : (
                      <Button small kind="ghost" title="Besorge ich" onPress={() => takeOver(w)} testID="gift-take" />
                    )}
                  </View>
                ))
              ) : (
                <T v="muted" style={{ paddingVertical: 6 }}>{partner.displayName} hat noch keine Wünsche eingetragen.</T>
              )}
              {theirWishes.length ? <T v="small" style={{ paddingTop: 4 }}>„Besorge ich“ legt eine geheime Idee an. {partner.displayName} sieht davon nichts.</T> : null}
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

function Empty({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
      <T v="muted" style={{ textAlign: 'center' }}>{text}</T>
      <Button small title={action} onPress={onPress} testID="add-gift-empty" />
    </View>
  );
}

function GiftRow({ g, first, onToggle, onDelete, onOpen }: {
  g: Gift; first: boolean; onToggle?: (g: Gift) => void; onDelete: (g: Gift) => void; onOpen: (g: Gift) => void;
}) {
  const t = useTheme();
  const { couple } = useApp();
  const sub = [g.occasion, host(g.link), g.wishId ? 'aus der Wunschliste' : null].filter(Boolean).join(' · ');
  const dot = personColors(t, couple?.members.find((m) => m.id === g.createdBy)?.color).dot;
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: t.line, paddingTop: first ? 0 : 6 }}>
      <SwipeToDelete onDelete={() => onDelete(g)}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, paddingVertical: 4, minHeight: 40 }}
          accessible
          accessibilityLabel={`${g.title}${sub ? `, ${sub}` : ''}${g.done ? ', besorgt' : ''}`}
          accessibilityActions={[...(onToggle ? [{ name: 'activate', label: g.done ? 'Nicht besorgt' : 'Besorgt' }] : []), { name: 'edit', label: 'Bearbeiten' }, { name: 'delete', label: 'Löschen' }]}
          onAccessibilityAction={(e) => {
            const a = e.nativeEvent.actionName;
            if (a === 'delete') onDelete(g);
            else if (a === 'activate' && onToggle) onToggle(g);
            else onOpen(g);
          }}>
          {onToggle ? (
            <Press
              onPress={() => onToggle(g)}
              scale={0.82}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityLabel={g.title}
              accessibilityState={{ checked: g.done }}
              style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: g.done ? t.green : t.lineStrong, backgroundColor: g.done ? t.green : 'transparent' }}>
              {g.done ? <IconCheck color={t.onAccent} size={14} /> : null}
            </Press>
          ) : (
            <T style={{ fontSize: 18 }}>🎁</T>
          )}
          <Press onPress={() => onOpen(g)} scale={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={[{ fontFamily: fonts.bodySemi }, g.done && { textDecorationLine: 'line-through', color: t.muted }]} numberOfLines={2}>{g.title}</T>
              {sub ? <T v="small" numberOfLines={1}>{sub}</T> : null}
            </View>
            {g.kind === 'idea' && !g.forUser ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} /> : null}
            <IconRight color={t.lineStrong} size={14} />
          </Press>
        </View>
      </SwipeToDelete>
    </View>
  );
}
