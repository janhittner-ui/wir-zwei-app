/**
 * Start: "Zusammen seit", Tagesvers, nächste Termine, Geburtstag, nächste Reise, offene Einkäufe.
 * Welche Karten in welcher Reihenfolge erscheinen, legt jede Person unter „Anpassen“ fest.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { APP_NAME } from '@/config';
import { usePrefs } from '@/data/prefs';
import { useApp, useBirthdays, useEvents, useMilestones, usePhotos, useShopping, useTrips } from '@/data/provider';
import { upcomingBirthdays } from '@/lib/birthdays';
import { cmpEvent, dayVerse, fullDate, longDay, parse, rel, together, ymd } from '@/lib/dates';
import { specialDays, specialText } from '@/lib/milestones';
import { goArea } from '@/lib/nav';
import { AREA_LABEL, visible, type Area, type HomeCard } from '@/lib/prefs';
import { shopEmoji } from '@/lib/shop-emoji';
import { nextTrip, tripCountdown, tripRange, tripStatus } from '@/lib/trips';
import { fonts, useTheme } from '@/theme';
import { IconCalendar, IconFork, IconGear, IconList, IconPencil, IconPhoto, IconPlus, IconQuiz, IconRight, IconSliders, IconSuitcase } from '@/ui/icons';
import { EventRow } from '@/ui/event-row';
import { Button, Card, CardHead, DateBadge, Press, Screen, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';

export default function Start() {
  const { couple, profile } = useApp();
  const { prefs } = usePrefs();
  const t = useTheme();
  const cards = visible(prefs.home);
  const more = prefs.areas.order.filter((a) => prefs.areas.hidden.includes(a));
  const alone = (couple?.members.length ?? 0) < 2;
  const invite = alone && couple ? <InviteCard key="invite" code={couple.inviteCode} /> : null;
  const CARD: Record<HomeCard, () => ReactNode> = {
    hero: () => <Hero key="hero" photoId={prefs.home.heroPhotoId} />,
    verse: () => <Verse key="verse" />,
    upcoming: () => <UpcomingCard key="upcoming" />,
    birthday: () => <BirthdayCard key="birthday" />,
    trip: () => <TripCard key="trip" />,
    shopping: () => <ShoppingCard key="shopping" />,
  };

  return (
    <Screen>
      {cards[0] === 'hero' ? CARD.hero() : null}
      {invite}
      {cards.filter((c, i) => !(i === 0 && c === 'hero')).map((c) => CARD[c]())}
      {!cards.length ? <T v="muted" style={{ textAlign: 'center' }}>Alle Karten sind ausgeblendet. Unter „Anpassen“ holst du sie zurück.</T> : null}
      {more.length ? <MoreAreas areas={more} /> : null}

      <View style={{ alignItems: 'center', gap: 2 }}>
        {!cards.includes('hero') ? (
          <Press onPress={() => router.push('/meilensteine')} style={{ padding: 8 }} testID="open-milestones">
            <T style={{ color: t.blue, fontFamily: fonts.bodySemi }}>❤️ Meilensteine</T>
          </Press>
        ) : null}
        <Press onPress={() => router.push('/anpassen')} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', padding: 8 }} testID="open-anpassen">
          <IconSliders color={t.blue} size={18} />
          <T style={{ color: t.blue, fontFamily: fonts.bodySemi }}>Anpassen</T>
        </Press>
        <Press onPress={() => router.push('/einstellungen')} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', padding: 8 }}>
          <IconGear color={t.muted} size={18} />
          <T v="muted">Einstellungen{profile ? ` · angemeldet als ${profile.displayName}` : ''}</T>
        </Press>
      </View>
    </Screen>
  );
}

function UpcomingCard() {
  const { couple } = useApp();
  const t = useTheme();
  const { items: events } = useEvents();
  const todayIso = ymd(new Date());
  const upcoming = useMemo(() => events.filter((e) => e.date >= todayIso).sort(cmpEvent).slice(0, 4), [events, todayIso]);
  return (
    <Card>
      <CardHead title="Demnächst" action={<Button kind="link" title="Kalender" onPress={() => goArea('kalender', { seg: 'monat' })} />} />
      {upcoming.length ? (
        upcoming.map((e, i) => <EventRow key={e.id} e={e} members={couple?.members ?? []} first={i === 0} />)
      ) : (
        <>
          <T v="muted">Keine Termine geplant.</T>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button small kind="ghost" title="Termin eintragen" icon={<IconPlus color={t.ink} size={18} />} onPress={() => router.push('/termin')} />
          </View>
        </>
      )}
    </Card>
  );
}

function BirthdayCard() {
  const t = useTheme();
  const { items: birthdays } = useBirthdays();
  const nextBd = useMemo(() => upcomingBirthdays(birthdays)[0], [birthdays]);
  return (
    <Card>
      <CardHead title="Nächster Geburtstag" action={<Button kind="link" title="Alle" onPress={() => goArea('kalender', { seg: 'geb' })} />} />
      {nextBd ? (
        <Press onPress={() => router.push({ pathname: '/geburtstag', params: { id: nextBd.id } })} scale={0.98} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <DateBadge date={nextBd.date} tone={{ soft: t.yellowSoft, ink: t.yellowInk }} />
          <View style={{ flex: 1 }}>
            <T v="big">{nextBd.name}</T>
            <T v="muted">{nextBd.age ? `wird ${nextBd.age} · ` : ''}{rel(nextBd.days)}</T>
          </View>
        </Press>
      ) : (
        <>
          <T v="muted">Noch keine Geburtstage eingetragen.</T>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button small kind="ghost" title="Geburtstag eintragen" icon={<IconPlus color={t.ink} size={18} />} onPress={() => router.push('/geburtstag')} />
          </View>
        </>
      )}
    </Card>
  );
}

/** Erscheint nur, wenn eine Reise geplant ist oder gerade läuft. */
function TripCard() {
  const t = useTheme();
  const { items: trips } = useTrips();
  const trip = useMemo(() => nextTrip(trips), [trips]);
  if (!trip) return null;
  return (
    <Card>
      <CardHead title={tripStatus(trip) === 'now' ? 'Gerade unterwegs' : 'Nächste Reise'} action={<Button kind="link" title="Reisen" onPress={() => goArea('kalender', { seg: 'reisen' })} />} />
      <Press onPress={() => router.push({ pathname: '/reise', params: { id: trip.id } })} scale={0.98} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} testID="start-trip">
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: t.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
          <IconSuitcase color={t.blue} size={26} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="big" numberOfLines={1}>{trip.title}</T>
          <T v="muted">{tripCountdown(trip)} · {tripRange(trip)}</T>
        </View>
      </Press>
    </Card>
  );
}

function ShoppingCard() {
  const { items: shopping } = useShopping();
  const open = useMemo(() => shopping.filter((s) => !s.done).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [shopping]);
  return (
    <Card>
      <CardHead title="Einkauf" action={<Button kind="link" title={open.length ? `${open.length} offen` : 'Liste'} onPress={() => goArea('listen', { seg: 'einkauf' })} />} />
      {open.length ? (
        <>
          {open.slice(0, 5).map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 21, width: 28, textAlign: 'center' }}>{shopEmoji(s.text)}</Text>
              <T style={{ flex: 1, fontFamily: fonts.bodySemi }}>{s.text}{s.qty ? <T v="small"> {s.qty}</T> : null}</T>
            </View>
          ))}
          {open.length > 5 ? <T v="muted">und {open.length - 5} weitere</T> : null}
        </>
      ) : (
        <T v="muted">Alles da. Nichts auf der Liste.</T>
      )}
    </Card>
  );
}

const AREA_ICON: Record<Area, (p: { color: string; size?: number }) => ReactNode> = {
  kalender: IconCalendar, listen: IconList, rezepte: IconFork, album: IconPhoto, quiz: IconQuiz,
};

/** Bereiche, die nicht in der Tab-Leiste sind (in „Anpassen“ ausgeblendet) */
function MoreAreas({ areas }: { areas: Area[] }) {
  const t = useTheme();
  return (
    <Card style={{ paddingVertical: 4, gap: 0 }}>
      {areas.map((a, i) => {
        const Icon = AREA_ICON[a];
        return (
          <Press key={a} onPress={() => goArea(a)} scale={0.98} accessibilityRole="button" testID={`more-${a}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: t.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon color={t.blue} size={18} />
            </View>
            <T style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 16 }}>{AREA_LABEL[a]}</T>
            <IconRight color={t.lineStrong} size={16} />
          </Press>
        );
      })}
    </Card>
  );
}

function Hero({ photoId }: { photoId: string | null }) {
  const { couple, profile } = useApp();
  const now = new Date();
  const h = now.getHours();
  const greet = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  const tg = couple?.togetherSince ? together(couple.togetherSince) : null;
  const { items: milestones } = useMilestones();
  const next = useMemo(() => specialDays(couple?.togetherSince ?? null, milestones)[0], [couple?.togetherSince, milestones]);
  const hint = next ? specialText(next) : tg?.anniv;
  const white = '#FFFFFF';

  // Tipp auf die Paar-Karte öffnet die Meilensteine
  return (
    <Press onPress={() => router.push('/meilensteine')} scale={0.985} style={[styles.hero]} accessibilityRole="button" accessibilityLabel="Paar-Karte, öffnet eure Meilensteine" testID="hero">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="stripes" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width="22" height="44" fill="rgba(255,255,255,0.06)" />
          </Pattern>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#080C16" stopOpacity={0.3} />
            <Stop offset="0.4" stopColor="#080C16" stopOpacity={0} />
            <Stop offset="1" stopColor="#080C16" stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="#24346F" />
        <Rect width="100%" height="100%" fill="url(#stripes)" />
        {photoId ? null : <Rect width="100%" height="100%" fill="url(#shade)" />}
      </Svg>
      {photoId ? <HeroPhoto id={photoId} /> : null}
      <View style={styles.heroTop}>
        <Text style={[styles.kicker, { color: white }]}>{longDay(now)}</Text>
        <Press onPress={() => router.push('/einstellungen')} style={styles.edit} accessibilityLabel="Bearbeiten">
          <IconPencil color={white} size={15} />
          <Text style={{ color: white, fontFamily: fonts.bodySemi, fontSize: 13 }}>Bearbeiten</Text>
        </Press>
      </View>
      <View style={styles.heroBottom}>
        {couple?.names ? <Text style={{ fontFamily: fonts.hand, fontSize: 30, color: white }}>{couple.names}</Text> : null}
        {tg ? (
          <>
            <Text style={[styles.since, { color: white }]}>Zusammen seit {fullDate(parse(couple!.togetherSince!))}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: white }}>{tg.text}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {hint ? (
                <View style={styles.anniv}>
                  <Text style={{ color: white, fontFamily: fonts.bodySemi, fontSize: 13 }} testID="hero-next">{next?.emoji ? `${next.emoji} ` : ''}{hint}</Text>
                </View>
              ) : null}
              <View style={[styles.anniv, { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.32)' }]}>
                <Text style={{ color: white, fontFamily: fonts.bodySemi, fontSize: 13 }}>Meilensteine</Text>
                <IconRight color={white} size={13} />
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.since, { color: white }]}>{greet}{profile ? `, ${profile.displayName}` : ''}</Text>
            <Press onPress={() => router.push('/einstellungen')} style={styles.setbtn}>
              <Text style={{ color: '#1A2130', fontFamily: fonts.bodyBold }}>Seit wann seid ihr zusammen?</Text>
            </Press>
          </>
        )}
      </View>
    </Press>
  );
}

/** Paar-Bild aus dem Album (in „Anpassen“ gewählt); wurde es gelöscht, bleibt das Muster. */
function HeroPhoto({ id }: { id: string }) {
  const { items } = usePhotos();
  const photo = items.find((p) => p.id === id);
  const urls = usePhotoUrls(photo ? [photo] : []);
  const uri = photo ? urls[photo.id] : undefined;
  return (
    <>
      {uri ? <Image source={{ uri, cacheKey: id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} /> : null}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="pshade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#080C16" stopOpacity={0.35} />
            <Stop offset="0.35" stopColor="#080C16" stopOpacity={0} />
            <Stop offset="0.55" stopColor="#080C16" stopOpacity={0.05} />
            <Stop offset="1" stopColor="#080C16" stopOpacity={0.7} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#pshade)" />
      </Svg>
    </>
  );
}

function InviteCard({ code }: { code: string | null }) {
  const { store, refresh } = useApp();
  const t = useTheme();
  const pretty = code ? `${code.slice(0, 4)}-${code.slice(4)}` : null;
  return (
    <Card style={{ borderWidth: 1.5, borderColor: t.pink }}>
      <T v="h2">Lade deinen Schatz ein</T>
      {pretty ? (
        <>
          <T v="muted">Dein Schatz installiert {APP_NAME}, meldet sich an und gibt diesen Code ein. Er gilt 48 Stunden.</T>
          <Text selectable style={{ fontFamily: fonts.displayHeavy, fontSize: 34, letterSpacing: 4, color: t.ink, textAlign: 'center' }} testID="invite-code-display">
            {pretty}
          </Text>
          <Button title="Code teilen" onPress={() => Share.share({ message: `Komm zu mir in ${APP_NAME}! Mein Einladungscode: ${pretty}` }).catch(() => {})} />
        </>
      ) : (
        <>
          <T v="muted">Der letzte Code ist abgelaufen.</T>
          <Button title="Neuen Code erzeugen" onPress={async () => { await store.createInvite().catch(() => {}); await refresh(); }} />
        </>
      )}
    </Card>
  );
}

function Verse() {
  const t = useTheme();
  const [txt, ref] = dayVerse();
  const long = txt.length > 140;
  return (
    <Card style={{ paddingHorizontal: 18, overflow: 'hidden' }}>
      <Text style={{ position: 'absolute', right: 12, top: -30, fontFamily: fonts.displayHeavy, fontSize: 150, color: t.blueSoft }} accessible={false}>
        {'“'}
      </Text>
      <T v="eyebrow">Tagesvers</T>
      <Text style={{ fontFamily: fonts.displaySemi, fontSize: long ? 15.5 : 18, lineHeight: long ? 22 : 24, color: t.ink }}>{txt}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <Text style={{ fontFamily: fonts.bodyBold, color: t.blue, fontSize: 14 }}>{ref}</Text>
        <T v="small" style={{ fontSize: 11.5 }}>Lutherbibel 1912</T>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, overflow: 'hidden', aspectRatio: 5 / 4, maxHeight: 480, width: '100%', backgroundColor: '#24346F' },
  heroTop: { position: 'absolute', top: 14, left: 16, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.92, paddingTop: 6, flexShrink: 1 },
  edit: { backgroundColor: 'rgba(10,14,22,0.5)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, flexDirection: 'row', gap: 5, alignItems: 'center' },
  heroBottom: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 3, alignItems: 'flex-start' },
  since: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.9 },
  anniv: { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  setbtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginTop: 6 },
});
