/** Einkaufsliste (Reiter im Tab „Listen“): schnell eintragen, abhaken, Erledigtes aufräumen. Änderungen erscheinen sofort beim Partner. */
import { useMemo, useRef, useState } from 'react';
import { Alert, Text, View, type TextInputInstance } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useShopping } from '@/data/provider';
import type { ShoppingItem } from '@/data/types';
import { splitQty } from '@/lib/qty';
import { shopEmoji } from '@/lib/shop-emoji';
import { fonts, personColors, useTheme } from '@/theme';
import { IconCheck, IconPlus } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Input, Press, T } from '@/ui/kit';
import { SwipeToDelete } from '@/ui/swipe-row';

export function ShoppingList() {
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

  const toggle = (it: ShoppingItem) => act((l) => l.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)), () => store.setShoppingDone(it.id, !it.done));
  const remove = (it: ShoppingItem) => act((l) => l.filter((x) => x.id !== it.id), () => store.deleteShopping(it.id));
  const rowProps = (it: ShoppingItem, i: number) => ({
    key: it.id, it, first: i === 0, byColor: personColors(t, couple?.members.find((m) => m.id === it.createdBy)?.color).dot,
    byName: couple?.members.find((m) => m.id === it.createdBy)?.displayName, onToggle: toggle, onDelete: remove,
  });

  return (
    <>
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
        {open.length ? open.map((it, i) => { const { key, ...p } = rowProps(it, i); return <ShopRow key={key} {...p} />; }) : <T v="muted">Alles da. Nichts auf der Liste.</T>}
        {items.length ? <T v="small" style={{ textAlign: 'center' }}>Zum Löschen nach links wischen</T> : null}
      </Card>

      {done.length ? (
        <Card>
          <CardHead title={`Erledigt (${done.length})`} action={<Button kind="link" title="Alle löschen" onPress={clearDone} />} />
          {done.map((it, i) => { const { key, ...p } = rowProps(it, i); return <ShopRow key={key} {...p} />; })}
        </Card>
      ) : null}
    </>
  );
}

/** Eine Zeile: runder Haken wie in "Erinnerungen", Emoji, Text, Punkt der Person. Nach links wischen = löschen. */
function ShopRow({ it, first, byColor, byName, onToggle, onDelete }: {
  it: ShoppingItem; first: boolean; byColor: string; byName?: string;
  onToggle: (it: ShoppingItem) => void; onDelete: (it: ShoppingItem) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: t.line, paddingTop: first ? 0 : 6 }}>
      <SwipeToDelete onDelete={() => onDelete(it)}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, paddingVertical: 4 }}
          accessible
          accessibilityLabel={`${it.text}${it.qty ? `, ${it.qty}` : ''}${it.done ? ', erledigt' : ''}`}
          accessibilityActions={[{ name: 'activate', label: it.done ? 'Wieder offen' : 'Abhaken' }, { name: 'delete', label: 'Löschen' }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'delete' ? onDelete(it) : onToggle(it))}>
          <Press
            onPress={() => onToggle(it)}
            scale={0.82}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityLabel={it.text}
            accessibilityState={{ checked: it.done }}
            style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: it.done ? t.blue : t.lineStrong, backgroundColor: it.done ? t.blue : 'transparent' }}>
            {it.done ? <IconCheck color={t.onAccent} size={14} /> : null}
          </Press>
          <Text style={{ fontSize: 21, width: 28, textAlign: 'center', opacity: it.done ? 0.55 : 1 }}>{shopEmoji(it.text)}</Text>
          <View style={{ flex: 1 }}>
            <T style={[{ fontFamily: fonts.bodySemi }, it.done && { textDecorationLine: 'line-through', color: t.muted, fontFamily: fonts.bodyMedium }]}>
              {it.text}
              {it.qty ? <T v="small"> {it.qty}</T> : null}
            </T>
          </View>
          {byName ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: byColor }} /> : null}
        </View>
      </SwipeToDelete>
    </View>
  );
}
