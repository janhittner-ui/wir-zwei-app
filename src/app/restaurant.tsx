/**
 * Restaurant anlegen oder bearbeiten: Name, Küche, Ort, Preis, Notiz.
 * Wenn ihr dort wart: Datum, eigene Sterne (die des Partners sieht man daneben) und ein Foto aus dem Album.
 * Steht es noch auf „Wollen wir hin“, kommt es mit einem Tipp auf die Date-Liste.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useDateIdeas, useRestaurants } from '@/data/provider';
import { ymd } from '@/lib/dates';
import { goArea } from '@/lib/nav';
import { avgStars, CUISINES, dateTitleFor, starsText } from '@/lib/restaurants';
import { fonts, useTheme } from '@/theme';
import { AlbumPicker } from '@/ui/album-picker';
import { DatePicker, FormRow } from '@/ui/date-field';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, T } from '@/ui/kit';
import { Stars } from '@/ui/stars';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { store, couple, profile } = useApp();
  const { items, loaded } = useRestaurants();
  const { items: dates } = useDateIdeas();
  const t = useTheme();
  const existing = id ? items.find((r) => r.id === id) : undefined;
  const me = profile?.id ?? null;
  const partner = couple?.members.find((m) => m.id !== me) ?? null;

  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [place, setPlace] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [visited, setVisited] = useState(false);
  const [visitedOn, setVisitedOn] = useState(ymd(new Date()));
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setName(existing.name);
      setCuisine(existing.cuisine ?? '');
      setPlace(existing.place ?? '');
      setPrice(existing.price);
      setNote(existing.note ?? '');
      setVisited(!!existing.visitedOn);
      if (existing.visitedOn) setVisitedOn(existing.visitedOn);
      setPhotoId(existing.photoId);
      setStars(existing.ratings.find((r) => r.userId === me)?.stars ?? null);
      setFilled(true);
    }
  }, [existing, filled, me]);

  const close = () => (router.canGoBack() ? router.back() : goArea('rezepte', { seg: 'restaurants' }, 'replace'));
  const input = () => ({ name, cuisine, place, price, note, visitedOn: visited ? visitedOn : null, photoId: visited ? photoId : null });

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const v = input();
      const rid = existing ? existing.id : (await store.addRestaurant(v)).id;
      if (existing) await store.updateRestaurant(rid, v);
      const mine = existing?.ratings.find((r) => r.userId === me)?.stars ?? null;
      if (visited && stars !== mine) await store.rateRestaurant(rid, stars);
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    const go = async () => {
      try {
        await store.deleteRestaurant(existing.id);
        close();
      } catch (e) {
        setErr(friendlyError(e));
      }
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert('Restaurant löschen?', existing.name, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: go },
    ]);
  };

  const dateTitle = dateTitleFor(name.trim() || existing?.name || '');
  const onDateList = dates.some((d) => !d.doneOn && norm(d.title) === norm(dateTitle));
  const toDateList = async () => {
    setErr(null);
    try {
      await store.addDateIdea({ title: dateTitle, category: 'essen', note: place.trim() || null, doneOn: null, photoId: null });
      setInfo('Steht jetzt auf eurer Date-Liste.');
    } catch (e) {
      setErr(friendlyError(e));
    }
  };

  if (id && loaded && !existing) {
    return (
      <Screen padTop={false}>
        <T v="h2">Dieses Restaurant wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  const partnerStars = partner ? existing?.ratings.find((r) => r.userId === partner.id)?.stars ?? null : null;
  const avg = existing && visited ? avgStars({ ratings: [...(stars ? [{ userId: me ?? '', stars }] : []), ...(partnerStars ? [{ userId: partner!.id, stars: partnerStars }] : [])] }) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Restaurant' : 'Neues Restaurant'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>

        <Input label="Name" value={name} onChangeText={setName} maxLength={80} placeholder="z. B. Da Mario" autoFocus={!existing} testID="rest-name" />

        <View style={{ gap: 8 }}>
          <Input label="Küche (optional)" value={cuisine} onChangeText={setCuisine} maxLength={40} placeholder="z. B. Italienisch" testID="rest-cuisine" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
            {CUISINES.map((c) => {
              const on = norm(cuisine) === norm(c);
              return (
                <Press key={c} onPress={() => setCuisine(on ? '' : c)} scale={0.92} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? t.blue : t.surface2 }}>
                  <T style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: on ? t.onAccent : t.ink }}>{c}</T>
                </Press>
              );
            })}
          </ScrollView>
        </View>

        <Input label="Ort (optional)" value={place} onChangeText={setPlace} maxLength={120} placeholder="z. B. Köln-Ehrenfeld" testID="rest-place" />

        <View style={{ gap: 8 }}>
          <T v="label">Preis (optional)</T>
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
            {[1, 2, 3, 4].map((p) => {
              const on = price === p;
              return (
                <Press key={p} onPress={() => setPrice(on ? null : p)} scale={0.92} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Preis ${p} von 4`} testID={`rest-price-${p}`}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, backgroundColor: on ? t.blue : t.surface2 }}>
                  <T style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? t.onAccent : t.ink }}>{'€'.repeat(p)}</T>
                </Press>
              );
            })}
          </View>
        </View>

        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FormRow label="Waren wir schon" first>
            <Switch value={visited} onValueChange={setVisited} trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel="Waren wir schon" testID="rest-visited" />
          </FormRow>
          {visited ? (
            <>
              <FormRow label="Zuletzt am">
                <DatePicker value={visitedOn} onChange={setVisitedOn} maximumDate={new Date()} testID="rest-visited-on" />
              </FormRow>
              <FormRow label="Deine Sterne">
                <Stars value={stars} onChange={setStars} size={22} testID="rest-star" />
              </FormRow>
              {partner ? (
                <FormRow label={partner.displayName}>
                  {partnerStars ? <Stars value={partnerStars} size={18} /> : <T v="small">noch keine Sterne</T>}
                </FormRow>
              ) : null}
              {avg && stars && partnerStars ? (
                <FormRow label="Durchschnitt">
                  <T style={{ fontFamily: fonts.bodySemi }}>{starsText(avg)} ★</T>
                </FormRow>
              ) : null}
            </>
          ) : null}
        </Card>
        {existing && !visited && existing.visitedOn ? (
          <T v="small" style={{ marginTop: -10 }}>Beim Speichern kommt es zurück auf „Wollen wir hin“, eure Sterne werden dabei gelöscht.</T>
        ) : null}

        <Input label="Notiz (optional)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder={visited ? 'Was hat euch geschmeckt? Was lieber nicht?' : 'Wer hat es empfohlen? Reservieren nötig?'} testID="rest-note" />

        {visited ? (
          <View style={{ gap: 8 }}>
            <T v="label">Foto aus eurem Album (optional)</T>
            <AlbumPicker value={photoId} onChange={setPhotoId} testID="rest-photo" />
          </View>
        ) : null}

        {existing && !visited && !existing.visitedOn ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T style={{ flex: 1 }}>{onDateList || info ? '✓ Steht auf eurer Date-Liste.' : 'Als Date planen?'}</T>
            {onDateList || info ? null : <Button small kind="ghost" title="Auf die Date-Liste" onPress={toDateList} testID="rest-to-date" />}
          </Card>
        ) : null}

        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} testID="rest-delete" /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="rest-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
