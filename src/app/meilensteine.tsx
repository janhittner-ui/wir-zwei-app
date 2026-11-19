/**
 * Meilensteine: öffnet sich beim Tippen auf die Paar-Karte der Startseite.
 * Oben „Zusammen seit“ in Zahlen, dann die nächsten besonderen Tage, darunter eure Zeitleiste.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useApp, useMilestones, usePhotos } from '@/data/provider';
import type { Milestone } from '@/data/types';
import { diffDays, fullDate, parse, rel, today, together } from '@/lib/dates';
import { dots, MILESTONE_ICONS, sortTimeline, specialDays } from '@/lib/milestones';
import { fonts, useTheme } from '@/theme';
import { IconLeft, IconPlus } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Press, Screen, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';

export default function Meilensteine() {
  const t = useTheme();
  const { couple } = useApp();
  const { items, loaded, error } = useMilestones();
  const { items: photos } = usePhotos();
  const since = couple?.togetherSince ?? null;
  const tg = since ? together(since) : null;
  const special = useMemo(() => specialDays(since, items).slice(0, 5), [since, items]);
  const timeline = useMemo(() => sortTimeline(items), [items]);
  const withPhoto = useMemo(() => photos.filter((p) => items.some((m) => m.photoId === p.id)), [photos, items]);
  const urls = usePhotoUrls(withPhoto);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const add = () => router.push('/meilenstein');
  const weeks = tg ? Math.floor(tg.total / 7) : 0;
  const months = tg ? tg.y * 12 + tg.m : 0;

  // „Zusammengekommen“ steht automatisch in der Zeitleiste, an der richtigen Stelle
  type Entry = { kind: 'since'; date: string } | { kind: 'm'; m: Milestone };
  const entries: Entry[] = timeline.map((m) => ({ kind: 'm', m }));
  if (since) {
    const i = entries.findIndex((e) => e.kind === 'm' && e.m.date > since);
    entries.splice(i < 0 ? entries.length : i, 0, { kind: 'since', date: since });
  }

  return (
    <Screen>
      <Press onPress={back} accessibilityRole="button" accessibilityLabel="Zurück zu Start" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: -8 }} testID="ms-back">
        <IconLeft color={t.blue} size={22} />
        <Text style={{ color: t.blue, fontFamily: fonts.body, fontSize: 17 }}>Start</Text>
      </Press>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flexShrink: 1 }}>
          <T v="eyebrow">Eure gemeinsame Geschichte</T>
          <T v="display">Meilensteine</T>
        </View>
        <Button small title="Neu" icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} testID="add-milestone" />
      </View>
      {error ? <Banner warn>Die Meilensteine konnten gerade nicht geladen werden.</Banner> : null}

      {tg ? (
        <Card>
          <T v="eyebrow">Zusammen seit {fullDate(parse(since!))}</T>
          <T style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 29 }}>{tg.text}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[dots(tg.total), tg.total === 1 ? 'Tag' : 'Tage'], [dots(weeks), weeks === 1 ? 'Woche' : 'Wochen'], [dots(months), months === 1 ? 'Monat' : 'Monate']].map(([n, l]) => (
              <View key={l} style={{ flex: 1, backgroundColor: t.blueSoft, borderRadius: 14, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 22, color: t.blue }}>{n}</Text>
                <T v="small" style={{ color: t.blue, fontFamily: fonts.bodySemi }}>{l}</T>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <Card>
          <T v="h2">Seit wann seid ihr zusammen?</T>
          <T v="muted">Mit dem Datum zählt die App eure gemeinsamen Tage und erinnert an Jahrestage und runde Zahlen.</T>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button small title="Datum festlegen" onPress={() => router.push('/einstellungen')} />
          </View>
        </Card>
      )}

      {special.length ? (
        <Card style={{ gap: 4 }}>
          <CardHead title="Besondere Tage" />
          {special.map((d, i) => (
            <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
              <Text style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{d.emoji}</Text>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: fonts.bodySemi }}>{d.title}</T>
                <T v="small">{fullDate(d.date)}</T>
              </View>
              <View style={{ backgroundColor: d.days === 0 ? t.pinkSoft : t.surface2, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                <T style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: d.days === 0 ? t.pinkInk : t.ink }}>{rel(d.days)}</T>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <T v="h2" style={{ marginBottom: -6 }}>Zeitleiste</T>
      {entries.length ? (
        <Card style={{ paddingVertical: 8, gap: 0 }}>
          {entries.map((e, i) => {
            const last = i === entries.length - 1;
            if (e.kind === 'since') {
              return (
                <TimelineRow key="since" emoji="❤️" date={e.date} title="Zusammengekommen" last={last} first={i === 0}
                  onPress={() => router.push('/einstellungen')} hint="Datum in den Einstellungen" />
              );
            }
            const m = e.m;
            return (
              <TimelineRow key={m.id} emoji={MILESTONE_ICONS[m.icon] ?? '❤️'} date={m.date} title={m.title} note={m.note} last={last} first={i === 0}
                photo={m.photoId ? urls[m.photoId] : undefined} photoKey={m.photoId ?? undefined}
                onPress={() => router.push({ pathname: '/meilenstein', params: { id: m.id } })} />
            );
          })}
        </Card>
      ) : null}
      {loaded && !items.length ? (
        <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
          <T v="muted" style={{ textAlign: 'center' }}>
            Haltet eure besonderen Momente fest: erstes Date, erster Urlaub, Verlobung, Hochzeit. Gern mit einem Foto aus eurem Album.
          </T>
          <Button small title="Ersten Meilenstein eintragen" onPress={add} testID="add-milestone-empty" />
        </View>
      ) : null}
    </Screen>
  );
}

function TimelineRow({ emoji, date, title, note, photo, photoKey, first, last, onPress, hint }: {
  emoji: string; date: string; title: string; note?: string | null; photo?: string; photoKey?: string;
  first: boolean; last: boolean; onPress: () => void; hint?: string;
}) {
  const t = useTheme();
  const d = parse(date);
  const days = diffDays(today(), d);
  return (
    <Press onPress={onPress} scale={0.98} accessibilityRole="button" accessibilityLabel={`${title}, ${fullDate(d)}${days > 0 ? `, ${rel(days)}` : ''}`} testID="ms-row"
      style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 40, alignItems: 'center' }}>
        <View style={{ width: 2, height: 10, backgroundColor: first ? 'transparent' : t.line }} />
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: days > 0 ? t.surface2 : t.blueSoft, alignItems: 'center', justifyContent: 'center', borderWidth: days > 0 ? 1.5 : 0, borderStyle: 'dashed', borderColor: t.lineStrong }}>
          <Text style={{ fontSize: 19 }}>{emoji}</Text>
        </View>
        <View style={{ width: 2, flex: 1, minHeight: 10, backgroundColor: last ? 'transparent' : t.line }} />
      </View>
      <View style={{ flex: 1, paddingTop: 10, paddingBottom: 14, gap: 2 }}>
        <T v="small" style={{ fontFamily: fonts.bodySemi, color: days > 0 ? t.pinkInk : t.muted }}>
          {fullDate(d)}{days > 0 ? ` · ${rel(days)}` : ''}
        </T>
        <T style={{ fontFamily: fonts.bodySemi, fontSize: 16 }}>{title}</T>
        {note ? <T v="muted" numberOfLines={3}>{note}</T> : null}
        {hint ? <T v="small">{hint}</T> : null}
        {photo ? (
          <Image source={{ uri: photo, cacheKey: photoKey }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginTop: 6, backgroundColor: t.surface2 }} contentFit="cover" transition={150} accessible={false} />
        ) : null}
      </View>
    </Press>
  );
}
