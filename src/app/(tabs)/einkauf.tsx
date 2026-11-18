/** Einkaufsliste: schnell eintragen, abhaken, Erledigtes aufräumen. Änderungen erscheinen sofort beim Partner. */
import { useMemo, useRef, useState } from 'react';
import { Alert, Text, View, type TextInputInstance } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useShopping } from '@/data/provider';
import type { ShoppingItem } from '@/data/types';
import { splitQty } from '@/lib/qty';
import { shopEmoji } from '@/lib/shop-emoji';
import { fonts, personColors, useTheme } from '@/theme';
import { IconCheck, IconPlus, IconX } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Input, Press, Screen, T } from '@/ui/kit';

export default function Einkauf() {
  const t = useTheme();
  const { store, couple } = useApp();
  const { items, setItems, error, reload } = useShopping();
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<TextInputInstance>(null);

  const open = useMemo(() => items.filter((i) => !i.done).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [items]);
  const done = useMemo(() => items.filter((i) => i.done), [items]);

  /** Sofort anzeigen, im Hintergrund speichern; bei Fehler neu laden (nie Daten vortäuschen). */
  const act = async (optimistic: (l: ShoppingItem[]) => ShoppingItem[], fn: () => Promise<unknown>) => {
    setErr(null);
    setItems(optimistic);
    try {
      await fn();
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    }
  };

  const add = async () => {
    const v = splitQty(draft);
    if (!v.text) return;
    setDraft('');
    setErr(null);
    try {
      const it = await store.addShopping(v);
      setItems((l) => (l.some((x) => x.id === it.id) ? l : [...l, it]));
    } catch (e) {
      setDraft(v.qty ? `${v.qty} ${v.text}` : v.text);
      setErr(friendlyError(e));
    }
    input.current?.focus();
  };

  const clearDone = () =>
    Alert.alert('Erledigte löschen?', `${done.length} Einträge werden entfernt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => act((l) => l.filter((x) => !x.done), () => store.clearDoneShopping()) },
    ]);

  const Row = ({ it, first }: { it: ShoppingItem; first: boolean }) => {
    const by = couple?.members.find((m) => m.id === it.createdBy);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: first ? 0 : 10, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
        <Press
          onPress={() => act((l) => l.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)), () => store.setShoppingDone(it.id, !it.done))}
          scale={0.82}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: it.done }}
          accessibilityLabel={it.text}
          style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: it.done ? t.blue : t.lineStrong, backgroundColor: it.done ? t.blue : 'transparent' }}>
          {it.done ? <IconCheck color={t.onAccent} size={16} /> : null}
        </Press>
        <Text style={{ fontSize: 21, width: 28, textAlign: 'center', opacity: it.done ? 0.55 : 1 }}>{shopEmoji(it.text)}</Text>
        <View style={{ flex: 1 }}>
          <T style={[{ fontFamily: fonts.bodySemi }, it.done && { textDecorationLine: 'line-through', color: t.muted, fontFamily: fonts.bodyMedium }]}>
            {it.text}
            {it.qty ? <T v="small"> {it.qty}</T> : null}
          </T>
        </View>
        {by ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: personColors(t, by.color).dot }} accessibilityLabel={`von ${by.displayName}`} /> : null}
        <Press onPress={() => act((l) => l.filter((x) => x.id !== it.id), () => store.deleteShopping(it.id))} accessibilityLabel={`${it.text} löschen`} scale={0.82} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          <IconX color={t.muted} size={16} />
        </Press>
      </View>
    );
  };

  return (
    <Screen>
      <View>
        <T v="eyebrow">Was fehlt?</T>
        <T v="display">Einkauf</T>
      </View>
      {error ? <Banner warn>Die Liste konnte gerade nicht geladen werden.</Banner> : null}

      <Card>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Input ref={input} value={draft} onChangeText={setDraft} placeholder="z. B. 2 l Milch" returnKeyType="done" submitBehavior="submit" onSubmitEditing={add} maxLength={150} testID="shop-input" />
          </View>
          <Press onPress={add} accessibilityLabel="Hinzufügen" testID="shop-add" style={{ backgroundColor: t.blue, borderRadius: 12, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <IconPlus color={t.onAccent} size={22} />
          </Press>
        </View>
        {err ? <Banner warn>{err}</Banner> : null}
        {open.length ? open.map((it, i) => <Row key={it.id} it={it} first={i === 0} />) : <T v="muted">Alles da. Nichts auf der Liste.</T>}
      </Card>

      {done.length ? (
        <Card>
          <CardHead title={`Erledigt (${done.length})`} action={<Button kind="link" title="Alle löschen" onPress={clearDone} />} />
          {done.map((it, i) => <Row key={it.id} it={it} first={i === 0} />)}
        </Card>
      ) : null}
    </Screen>
  );
}
