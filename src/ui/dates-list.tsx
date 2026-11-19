/**
 * Dates (Reiter im Tab „Listen“): gemeinsame Ideen für Dates.
 * Oben „Zufälliges Date“, dann offene Ideen (abhaken = heute gemacht), Vorschläge zum Antippen und was ihr schon gemacht habt.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useDateIdeas, usePhotos } from '@/data/provider';
import type { DateIdea, DateIdeaInput } from '@/data/types';
import { fullDate, parse, ymd } from '@/lib/dates';
import { DATE_CATEGORY, openSuggestions, pickKey, randomDate, splitDates, type DateSuggestion, type RandomPick } from '@/lib/date-ideas';
import { fonts, personColors, useTheme } from '@/theme';
import { IconCheck, IconPlus, IconRight } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Press, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';
import { SwipeToDelete } from '@/ui/swipe-row';

const SHOW_SUGG = 6;

const input = (d: DateIdea, patch: Partial<DateIdeaInput> = {}): DateIdeaInput =>
  ({ title: d.title, category: d.category, note: d.note, doneOn: d.doneOn, photoId: d.photoId, ...patch });

export function DatesList() {
  const t = useTheme();
  const { store, couple } = useApp();
  const { items, setItems, loaded, error, reload } = useDateIdeas();
  const { items: photos } = usePhotos();
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pick, setPick] = useState<RandomPick>(null);
  const [showDone, setShowDone] = useState(false);
  const [moreSugg, setMoreSugg] = useState(false);

  const { open, done } = useMemo(() => splitDates(items), [items]);
  const sugg = useMemo(() => openSuggestions(items), [items]);
  const donePhotos = useMemo(() => photos.filter((p) => done.some((d) => d.photoId === p.id)), [photos, done]);
  const urls = usePhotoUrls(donePhotos);
  // ein gezogenes Date, das es nicht mehr gibt oder schon erledigt ist, verschwindet
  const shownPick = pick?.kind === 'idea' ? (open.some((i) => i.id === pick.idea.id) ? pick : null) : pick?.kind === 'suggestion' && sugg.includes(pick.suggestion) ? pick : null;

  const act = async (optimistic: (l: DateIdea[]) => DateIdea[], fn: () => Promise<unknown>) => {
    setErr(null);
    setItems(optimistic);
    try {
      await fn();
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    }
  };
  const toggle = (d: DateIdea) => {
    const doneOn = d.doneOn ? null : ymd(new Date());
    const v = input(d, { doneOn, photoId: doneOn ? d.photoId : null });
    if (doneOn) {
      setShowDone(true);
      setHint(`„${d.title}“ ist erledigt. Tippe unten bei „Schon gemacht“ darauf, um ein Foto oder eine Notiz dazuzulegen.`);
    } else setHint(null);
    return act((l) => l.map((x) => (x.id === d.id ? { ...x, ...v } : x)), () => store.updateDateIdea(d.id, v));
  };
  const remove = (d: DateIdea) => act((l) => l.filter((x) => x.id !== d.id), () => store.deleteDateIdea(d.id));
  const addSuggestion = async (s: DateSuggestion) => {
    setErr(null);
    try {
      await store.addDateIdea({ title: s.title, category: s.category, note: null, doneOn: null, photoId: null });
      reload();
    } catch (e) {
      setErr(friendlyError(e));
    }
  };
  const roll = () => setPick(randomDate(items, pickKey(shownPick)));
  const dot = (uid: string | null) => personColors(t, couple?.members.find((x) => x.id === uid)?.color).dot;
  const add = () => router.push('/date-idee');

  return (
    <>
      {error ? <Banner warn>Die Liste konnte gerade nicht geladen werden.</Banner> : null}

      <Card style={{ gap: 12, alignItems: 'center', backgroundColor: t.blueSoft, borderColor: 'transparent' }}>
        {shownPick ? (
          <RandomResult pick={shownPick} onAdd={addSuggestion} />
        ) : (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 34 }}>🎲</Text>
            <T style={{ fontFamily: fonts.display, fontSize: 20, textAlign: 'center' }}>Keine Idee für heute?</T>
            <T v="muted" style={{ textAlign: 'center' }}>Lasst den Zufall entscheiden.</T>
          </View>
        )}
        <Button small title={shownPick ? 'Nochmal' : 'Zufälliges Date'} onPress={roll} testID="date-random" />
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="h2" style={{ fontSize: 20 }}>Eure Ideen</T>
        <Button small title="Neu" icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} testID="add-date" />
      </View>
      {err ? <Banner warn>{err}</Banner> : null}
      {hint ? <Banner>{hint}</Banner> : null}

      <Card style={{ gap: 4 }}>
        {open.length ? (
          <>
            {open.map((d, i) => <DateRow key={d.id} d={d} first={i === 0} dot={dot(d.createdBy)} onToggle={toggle} onDelete={remove} />)}
            <T v="small" style={{ textAlign: 'center', paddingTop: 6 }}>Abhaken, wenn ihr es gemacht habt. Zum Löschen nach links wischen.</T>
          </>
        ) : (
          <T v="muted" style={{ paddingVertical: 8 }}>
            {loaded && !items.length ? 'Sammelt hier, was ihr zusammen unternehmen wollt. Unten findet ihr ein paar Vorschläge.' : 'Alle Ideen erledigt. Zeit für neue!'}
          </T>
        )}
      </Card>

      {sugg.length ? (
        <Card style={{ gap: 10 }}>
          <CardHead title="Vorschläge" action={sugg.length > SHOW_SUGG ? <Button kind="link" title={moreSugg ? 'Weniger' : 'Mehr'} onPress={() => setMoreSugg((v) => !v)} testID="date-more-sugg" /> : undefined} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(moreSugg ? sugg : sugg.slice(0, SHOW_SUGG)).map((s) => (
              <Press key={s.title} onPress={() => addSuggestion(s)} scale={0.94} accessibilityRole="button" accessibilityLabel={`${s.title} auf die Liste`} testID="date-sugg"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.surface2, maxWidth: '100%' }}>
                <Text style={{ fontSize: 14 }}>{DATE_CATEGORY[s.category].emoji}</Text>
                <T style={{ fontFamily: fonts.bodySemi, fontSize: 13, flexShrink: 1 }} numberOfLines={2}>{s.title}</T>
                <IconPlus color={t.blue} size={14} />
              </Press>
            ))}
          </View>
        </Card>
      ) : null}

      {done.length ? (
        <Card style={{ gap: 4 }}>
          <CardHead title={`Schon gemacht (${done.length})`} action={<Button kind="link" title={showDone ? 'Ausblenden' : 'Anzeigen'} onPress={() => setShowDone((v) => !v)} testID="date-show-done" />} />
          {showDone ? done.map((d, i) => <DateRow key={d.id} d={d} first={i === 0} dot={dot(d.createdBy)} photo={d.photoId ? urls[d.photoId] : undefined} onToggle={toggle} onDelete={remove} />) : null}
        </Card>
      ) : null}
    </>
  );
}

function RandomResult({ pick, onAdd }: { pick: NonNullable<RandomPick>; onAdd: (s: DateSuggestion) => void }) {
  const title = pick.kind === 'idea' ? pick.idea.title : pick.suggestion.title;
  const cat = DATE_CATEGORY[pick.kind === 'idea' ? pick.idea.category : pick.suggestion.category];
  return (
    <View style={{ alignItems: 'center', gap: 6 }} accessibilityLiveRegion="polite" testID="date-pick">
      <Text style={{ fontSize: 38 }}>{cat.emoji}</Text>
      <T v="eyebrow">{pick.kind === 'idea' ? 'Aus eurer Liste' : 'Vorschlag'}</T>
      <T style={{ fontFamily: fonts.display, fontSize: 22, textAlign: 'center' }}>{title}</T>
      {pick.kind === 'idea' && pick.idea.note ? <T v="muted" style={{ textAlign: 'center' }} numberOfLines={3}>{pick.idea.note}</T> : null}
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {pick.kind === 'suggestion' ? <Button kind="link" title="Auf die Liste" onPress={() => onAdd(pick.suggestion)} testID="date-pick-add" /> : null}
        <Button kind="link" title="In den Kalender" onPress={() => router.push({ pathname: '/termin', params: { title } })} testID="date-pick-cal" />
      </View>
    </View>
  );
}

function DateRow({ d, first, dot, photo, onToggle, onDelete }: {
  d: DateIdea; first: boolean; dot: string; photo?: string; onToggle: (d: DateIdea) => void; onDelete: (d: DateIdea) => void;
}) {
  const t = useTheme();
  const cat = DATE_CATEGORY[d.category];
  const sub = d.doneOn ? fullDate(parse(d.doneOn)) : cat.label;
  const open = () => router.push({ pathname: '/date-idee', params: { id: d.id } });
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: t.line, paddingTop: first ? 0 : 6 }}>
      <SwipeToDelete onDelete={() => onDelete(d)}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, paddingVertical: 4 }}
          accessible
          accessibilityLabel={`${d.title}, ${d.doneOn ? `gemacht am ${sub}` : cat.label}`}
          accessibilityActions={[{ name: 'activate', label: d.doneOn ? 'Doch noch nicht gemacht' : 'Gemacht' }, { name: 'delete', label: 'Löschen' }, { name: 'edit', label: 'Bearbeiten' }]}
          onAccessibilityAction={(e) => {
            const a = e.nativeEvent.actionName;
            if (a === 'delete') onDelete(d);
            else if (a === 'edit') open();
            else onToggle(d);
          }}>
          <Press
            onPress={() => onToggle(d)}
            scale={0.82}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityLabel={d.title}
            accessibilityState={{ checked: !!d.doneOn }}
            testID="date-check"
            style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: d.doneOn ? t.blue : t.lineStrong, backgroundColor: d.doneOn ? t.blue : 'transparent' }}>
            {d.doneOn ? <IconCheck color={t.onAccent} size={14} /> : null}
          </Press>
          {photo ? (
            <Image source={{ uri: photo, cacheKey: d.photoId ?? undefined }} style={{ width: 36, height: 36, borderRadius: 8 }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{cat.emoji}</Text>
          )}
          <Press onPress={open} scale={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} testID="date-row">
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontFamily: fonts.bodySemi }} numberOfLines={2}>{d.title}</T>
              <T v="small" numberOfLines={1}>{d.note && d.doneOn ? `${sub} · ${d.note}` : sub}</T>
            </View>
            {!d.doneOn ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} /> : null}
            <IconRight color={t.lineStrong} size={14} />
          </Press>
        </View>
      </SwipeToDelete>
    </View>
  );
}
