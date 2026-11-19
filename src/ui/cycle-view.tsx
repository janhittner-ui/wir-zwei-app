/**
 * Zyklus (Reiter im Kalender): eigene Perioden eintragen, Vorhersage, Verlauf und der eigene
 * Schalter „mit dem Partner teilen“. Geteilte Daten des Partners erscheinen oben, nur lesbar.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Switch, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useCyclePeriods } from '@/data/provider';
import type { CyclePeriod } from '@/data/types';
import { cycleHeadline, cycleInfo, type CycleInfo } from '@/lib/cycle';
import { diffDays, MSHORT, parse, rel, ymd } from '@/lib/dates';
import { fonts, useTheme } from '@/theme';
import { IconRight } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Press, T } from '@/ui/kit';

const short = (d: Date) => `${d.getDate()}. ${MSHORT[d.getMonth()]}`;
const range = (a: Date, b: Date) => `${short(a)} – ${short(b)}`;

export function CycleView() {
  const t = useTheme();
  const { store, profile, couple } = useApp();
  const { items, setItems, loaded, error, reload } = useCyclePeriods();
  const me = profile?.id;
  const partner = couple?.members.find((m) => m.id !== me);
  const mine = useMemo(() => items.filter((p) => p.userId === me), [items, me]);
  const theirs = useMemo(() => items.filter((p) => partner && p.userId === partner.id), [items, partner]);
  const info = useMemo(() => cycleInfo(mine), [mine]);
  const their = useMemo(() => cycleInfo(theirs), [theirs]);
  const [share, setShare] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    store.getCycleSharing().then(setShare).catch(() => setShare(false));
  }, [store]);

  const last = mine[mine.length - 1];
  const open = last && !last.end && info.ongoingDay ? last : null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  const started = () => run(async () => {
    const p = await store.addCyclePeriod({ start: ymd(new Date()), end: null });
    setItems((l) => [...l, p]);
  });
  const ended = () => open && run(() => store.updateCyclePeriod(open.id, { start: open.start, end: ymd(new Date()) }));
  const toggleShare = (v: boolean) => {
    setShare(v);
    store.setCycleSharing(v).catch((e) => {
      setShare(!v);
      setErr(friendlyError(e));
    });
  };

  return (
    <>
      {error ? <Banner warn>Der Zyklus konnte gerade nicht geladen werden.</Banner> : null}

      {theirs.length && partner ? (
        <Card style={{ gap: 6 }}>
          <T v="eyebrow">Zyklus von {partner.displayName}</T>
          <T style={{ fontFamily: fonts.display, fontSize: 22 }}>{cycleHeadline(their)}</T>
          <Forecast info={their} />
          <T v="small">{partner.displayName} teilt das mit dir. Nur {partner.displayName} kann Einträge ändern.</T>
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <T v="eyebrow">Dein Zyklus</T>
        {mine.length ? (
          <>
            <T style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 30 }} testID="cycle-headline">{cycleHeadline(info)}</T>
            {info.cycleDay && !info.ongoingDay ? <T v="muted">Zyklustag {info.cycleDay}{info.fertileNow ? ' · fruchtbare Tage (geschätzt)' : ''}</T> : null}
          </>
        ) : loaded ? (
          <T v="muted">
            Trag den ersten Tag deiner Periode ein. Die App schätzt dann, wann die nächste kommt und wann die fruchtbaren Tage sind.
            Das siehst nur du, außer du teilst es unten.
          </T>
        ) : null}
        {err ? <Banner warn>{err}</Banner> : null}
        {open ? (
          <Button title="Periode ist vorbei" kind="ghost" busy={busy} onPress={ended} testID="cycle-end" />
        ) : (
          <Button title="Periode hat heute begonnen" busy={busy} onPress={started} testID="cycle-start" />
        )}
        <View style={{ alignSelf: 'center' }}>
          <Button kind="link" title="Anderes Datum eintragen" onPress={() => router.push('/periode')} testID="cycle-add" />
        </View>
      </Card>

      {mine.length ? (
        <Card style={{ gap: 4 }}>
          <CardHead title="Vorhersage" />
          <Forecast info={info} />
          <T v="small" style={{ paddingTop: 4 }}>
            {info.learned ? `Aus deinen letzten Einträgen berechnet.` : `Mit üblichen Werten geschätzt. Ab der zweiten Periode rechnet die App mit deinem eigenen Zyklus.`}
          </T>
        </Card>
      ) : null}

      {mine.length ? (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          <View style={{ paddingVertical: 6 }}><T v="h2">Verlauf</T></View>
          {[...mine].reverse().map((p, i) => <PeriodRow key={p.id} p={p} first={i === 0} />)}
        </Card>
      ) : null}

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T style={{ flex: 1, fontSize: 16 }}>{partner ? `Mit ${partner.displayName} teilen` : 'Mit deinem Schatz teilen'}</T>
          <Switch value={!!share} disabled={share === null || !partner} onValueChange={toggleShare} trackColor={{ true: t.green, false: t.lineStrong }}
            accessibilityLabel="Zyklus mit dem Partner teilen" testID="cycle-share" />
        </View>
        <T v="small">
          {share
            ? `${partner?.displayName ?? 'Dein Schatz'} sieht Beginn, Ende und die Vorhersage. Ändern kannst nur du. Du kannst das jederzeit ausschalten.`
            : 'Aus: Nur du siehst deinen Zyklus. Das prüft der Server, nicht nur die App.'}
        </T>
      </Card>

      <T v="small" style={{ textAlign: 'center', paddingHorizontal: 8 }}>
        Die Vorhersage ist nur eine Schätzung aus deinen Einträgen. Sie ist keine Verhütungsmethode und ersetzt keine ärztliche Beratung.
      </T>
    </>
  );
}

function Forecast({ info }: { info: CycleInfo }) {
  const t = useTheme();
  const today = new Date();
  const rows: [string, string][] = [];
  const late = info.daysUntil != null && info.daysUntil < 0;
  if (info.nextStart) {
    rows.push(late
      ? ['Erwartet war', short(info.nextStart)]
      : ['Nächste Periode', `${short(info.nextStart)} · ${rel(diffDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), info.nextStart))}`]);
  }
  // überfällig: die Schätzung für diesen Zyklus ist vorbei, neue Werte gibt es mit dem nächsten Eintrag
  if (!late && info.fertileStart && info.fertileEnd) rows.push(['Fruchtbare Tage', range(info.fertileStart, info.fertileEnd)]);
  if (!late && info.ovulation) rows.push(['Eisprung (geschätzt)', short(info.ovulation)]);
  rows.push(['Ø Zyklus', `${info.cycleLength} Tage`], ['Ø Periode', `${info.periodLength} Tage`]);
  if (!info.count) return null;
  return (
    <View>
      {rows.map(([l, v], i) => (
        <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, minHeight: 40, alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
          <T v="muted">{l}</T>
          <T style={{ fontFamily: fonts.bodySemi }}>{v}</T>
        </View>
      ))}
    </View>
  );
}

function PeriodRow({ p, first }: { p: CyclePeriod; first: boolean }) {
  const t = useTheme();
  const s = parse(p.start);
  const days = p.end ? diffDays(s, parse(p.end)) + 1 : null;
  const label = p.end ? `${range(s, parse(p.end))} ${parse(p.end).getFullYear()}` : `seit ${short(s)} ${s.getFullYear()}`;
  return (
    <Press onPress={() => router.push({ pathname: '/periode', params: { id: p.id } })} scale={0.98} accessibilityRole="button" accessibilityLabel={`${label}${days ? `, ${days} Tage` : ''}, bearbeiten`} testID="period-row"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.pink }} />
      <T style={{ flex: 1, fontFamily: fonts.bodySemi }}>{label}</T>
      {days ? <T v="small">{days} {days === 1 ? 'Tag' : 'Tage'}</T> : <T v="small" style={{ color: t.pinkInk }}>läuft</T>}
      <IconRight color={t.lineStrong} size={14} />
    </Press>
  );
}
