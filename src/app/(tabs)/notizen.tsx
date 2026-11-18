/** Notizen: farbige Zettel, die beide sehen und bearbeiten können. Neueste zuerst. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useApp, useNotes } from '@/data/provider';
import { searchKey } from '@/lib/birthdays';
import { MSHORT } from '@/lib/dates';
import { fonts, personColors, useTheme } from '@/theme';
import { IconPlus, IconX } from '@/ui/icons';
import { Banner, Button, Input, Press, Screen, T } from '@/ui/kit';

export default function Notizen() {
  const t = useTheme();
  const { couple } = useApp();
  const { items, loaded, error } = useNotes();
  const [q, setQ] = useState('');
  const notes = useMemo(() => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items]);
  const key = searchKey(q);
  const hits = key ? notes.filter((n) => searchKey(`${n.title ?? ''} ${n.body}`).includes(key)) : notes;
  const add = () => router.push('/notiz');

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <T v="eyebrow">{notes.length === 1 ? '1 Notiz' : `${notes.length} Notizen`}</T>
          <T v="display">Notizen</T>
        </View>
        <Button small title="Notiz" icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} testID="add-note" />
      </View>
      {error ? <Banner warn>Notizen konnten gerade nicht geladen werden.</Banner> : null}

      {notes.length > 3 ? (
        <View style={{ justifyContent: 'center' }}>
          <Input value={q} onChangeText={setQ} placeholder="Notizen durchsuchen …" autoCorrect={false} returnKeyType="search" accessibilityLabel="Notizen durchsuchen" style={{ backgroundColor: t.surface2, borderColor: 'transparent', paddingRight: 42 }} testID="note-search" />
          {q ? (
            <Press onPress={() => setQ('')} accessibilityLabel="Suche leeren" style={{ position: 'absolute', right: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <IconX color={t.muted} size={16} />
            </Press>
          ) : null}
        </View>
      ) : null}

      {notes.length ? (
        hits.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {hits.map((n) => {
              const by = couple?.members.find((m) => m.id === n.updatedBy);
              const d = new Date(n.updatedAt);
              return (
                <Press
                  key={n.id}
                  onPress={() => router.push({ pathname: '/notiz', params: { id: n.id } })}
                  scale={0.965}
                  accessibilityLabel={`${n.title ?? 'Notiz'}: ${n.body.slice(0, 80)}`}
                  style={{
                    flexBasis: '46%', flexGrow: 1, minHeight: 120, borderRadius: 16, padding: 14, gap: 6,
                    backgroundColor: t[n.color], shadowColor: t.shadow, shadowOpacity: t.dark ? 0.3 : 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
                  }}>
                  {n.title ? <Text style={{ fontFamily: fonts.display, fontSize: 16, color: t.ink }} numberOfLines={2}>{n.title}</Text> : null}
                  <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.ink }} numberOfLines={7}>{n.body}</Text>
                  <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <T v="small" style={{ fontSize: 12 }}>{d.getDate()}. {MSHORT[d.getMonth()]}</T>
                    {by ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: personColors(t, by.color).dot }} accessibilityLabel={`zuletzt von ${by.displayName}`} /> : null}
                  </View>
                </Press>
              );
            })}
          </View>
        ) : (
          <T v="muted">Nichts gefunden.</T>
        )
      ) : loaded ? (
        <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
          <T v="muted" style={{ textAlign: 'center' }}>
            Hier landen Ideen, Geschenkideen, Rezepte oder das WLAN-Passwort für Gäste. Was einer schreibt, sieht der andere sofort.
          </T>
          <Button small title="Erste Notiz" onPress={add} />
        </View>
      ) : null}
    </Screen>
  );
}
