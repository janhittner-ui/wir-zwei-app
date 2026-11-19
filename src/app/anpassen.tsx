/**
 * Anpassen: Jede Person gestaltet die App für sich, wie in den iOS-Einstellungen.
 * Aussehen, Tab-Leiste, Startseite und kleine Schalter pro Bereich. Verschieben über „Bearbeiten“
 * mit Pfeilen (kein freies Ziehen), damit nichts aus Versehen durcheinander gerät.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { useApp, usePhotos } from '@/data/provider';
import {
  ACCENTS, ACCENT_LABEL, AREA_LABEL, DEFAULT_PREFS, HOME_LABEL, LIST_LABEL, move, toggleHidden,
  type Mode, type Ordered, type Prefs,
} from '@/lib/prefs';
import { ACCENT_COLORS, fonts, useTheme } from '@/theme';
import { IconCheck, IconDown, IconUp, IconX } from '@/ui/icons';
import { Button, Card, Press, Screen, Segmented, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';

export default function Anpassen() {
  const t = useTheme();
  const { couple, profile } = useApp();
  const { prefs, update } = usePrefs();
  const partner = couple?.members.find((m) => m.id !== profile?.id);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => update((p) => ({ ...p, [k]: v }));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const reset = () => {
    const go = () => update(() => DEFAULT_PREFS);
    if (Platform.OS === 'web') return go();
    Alert.alert('Alles zurücksetzen?', 'Farbe, Tabs, Startseite und alle Schalter kommen wieder in den Ausgangszustand.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Zurücksetzen', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen padTop={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <T v="h2" style={{ fontSize: 22 }}>Anpassen</T>
        <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <IconX color={t.muted} size={20} />
        </Press>
      </View>
      <T v="muted" style={{ marginTop: -8 }}>
        Gilt nur für dich{partner ? `. ${partner.displayName} gestaltet die App für sich selbst` : ''}. Änderungen wirken sofort.
      </T>

      <Section title="Aussehen">
        <Row label="Darstellung" first>
          <Segmented<Mode> value={prefs.look.mode} onChange={(mode) => set('look', { ...prefs.look, mode })}
            options={[{ key: 'system', label: 'Auto' }, { key: 'light', label: 'Hell' }, { key: 'dark', label: 'Dunkel' }]} />
        </Row>
        <View style={{ gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.line }}>
          <T style={{ fontSize: 16 }}>Akzentfarbe</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }} accessibilityRole="radiogroup">
            {ACCENTS.map((a) => {
              const on = prefs.look.accent === a;
              const c = ACCENT_COLORS[a][t.dark ? 2 : 0];
              return (
                <Press key={a} onPress={() => set('look', { ...prefs.look, accent: a })} scale={0.88} accessibilityRole="radio" accessibilityLabel={ACCENT_LABEL[a]} accessibilityState={{ selected: on }} testID={`accent-${a}`}
                  style={{ alignItems: 'center', gap: 4, width: 48 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: on ? t.ink : 'transparent' }}>
                    {on ? <IconCheck color={t.onAccent} size={16} /> : null}
                  </View>
                  <T v="small" style={{ fontSize: 11.5, color: on ? t.ink : t.muted }}>{ACCENT_LABEL[a]}</T>
                </Press>
              );
            })}
          </View>
        </View>
      </Section>

      <OrderedSection
        title="Tab-Leiste"
        footer="Start ist immer dabei. Ausgeblendete Bereiche findest du auf der Startseite ganz unten."
        value={prefs.areas}
        labels={AREA_LABEL}
        onChange={(areas) => set('areas', areas)}
        fixedFirst="Start"
        testID="tabs"
      />

      <OrderedSection
        title="Startseite"
        footer="„Nächste Reise“ erscheint nur, wenn eine Reise geplant ist."
        value={prefs.home}
        labels={HOME_LABEL}
        onChange={(home) => set('home', { ...prefs.home, ...home })}
        testID="home"
      />
      <HeroPicker value={prefs.home.heroPhotoId} onChange={(heroPhotoId) => set('home', { ...prefs.home, heroPhotoId })} />

      <OrderedSection
        title="Listen"
        footer="Welche Reiter oben in „Listen“ stehen. Einer bleibt immer sichtbar."
        value={prefs.lists}
        labels={LIST_LABEL}
        onChange={(lists) => set('lists', lists)}
        minVisible={1}
        testID="lists"
      />

      <Section title="Kalender">
        <Row label="Geburtstage im Monat zeigen" first>
          <Switch value={prefs.kalender.showBirthdays} onValueChange={(showBirthdays) => set('kalender', { showBirthdays })}
            trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel="Geburtstage im Monat zeigen" testID="pref-kal-bd" />
        </Row>
      </Section>

      <Section title="Rezepte">
        <Row label="Sortierung" first>
          <Segmented value={prefs.rezepte.sort} onChange={(sort) => set('rezepte', { sort })}
            options={[{ key: 'name', label: 'A–Z' }, { key: 'neu', label: 'Zuletzt geändert' }]} />
        </Row>
      </Section>

      <Section title="Album">
        <Row label="Fotos pro Reihe" first>
          <Segmented value={String(prefs.album.cols) as '3' | '4'} onChange={(c) => set('album', { cols: c === '4' ? 4 : 3 })}
            options={[{ key: '3', label: '3' }, { key: '4', label: '4' }]} />
        </Row>
      </Section>

      <View style={{ alignItems: 'center' }}>
        <Button kind="link" title="Alles zurücksetzen" onPress={reset} testID="prefs-reset" />
      </View>
    </Screen>
  );
}

function Section({ title, footer, action, children }: { title: string; footer?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4 }}>
        <T v="eyebrow">{title}</T>
        {action}
      </View>
      <Card style={{ paddingVertical: 2, gap: 0 }}>{children}</Card>
      {footer ? <T v="small" style={{ paddingHorizontal: 4 }}>{footer}</T> : null}
    </View>
  );
}

function Row({ label, first, children, left }: { label: string; first?: boolean; children?: ReactNode; left?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 6, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
      {left}
      <T style={{ flex: 1, fontSize: 16 }} numberOfLines={2}>{label}</T>
      {children}
    </View>
  );
}

/** Liste mit Schaltern; „Bearbeiten“ blendet Pfeile zum Verschieben ein. */
function OrderedSection<K extends string>({ title, footer, value, labels, onChange, minVisible = 0, fixedFirst, testID }: {
  title: string; footer?: string; value: Ordered<K>; labels: Record<K, string>; onChange: (v: Ordered<K>) => void;
  minVisible?: number; fixedFirst?: string; testID: string;
}) {
  const t = useTheme();
  const [edit, setEdit] = useState(false);
  const visibleCount = value.order.length - value.hidden.length;
  return (
    <Section title={title} footer={footer}
      action={<Button kind="link" title={edit ? 'Fertig' : 'Bearbeiten'} onPress={() => setEdit((e) => !e)} testID={`${testID}-edit`} />}>
      {fixedFirst ? (
        <Row label={fixedFirst} first>
          <T v="small">immer</T>
        </Row>
      ) : null}
      {value.order.map((k, i) => {
        const on = !value.hidden.includes(k);
        const locked = on && visibleCount <= minVisible;
        return (
          <Row key={k} label={labels[k]} first={!fixedFirst && i === 0}
            left={edit ? (
              <View style={{ flexDirection: 'row', gap: 2 }}>
                <Arrow dir={-1} disabled={i === 0} label={`${labels[k]} nach oben`} onPress={() => onChange(move(value, k, -1))} testID={`${testID}-up-${k}`} />
                <Arrow dir={1} disabled={i === value.order.length - 1} label={`${labels[k]} nach unten`} onPress={() => onChange(move(value, k, 1))} testID={`${testID}-down-${k}`} />
              </View>
            ) : null}>
            <Switch value={on} disabled={locked} onValueChange={() => onChange(toggleHidden(value, k, minVisible))}
              trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel={labels[k]} testID={`${testID}-${k}`} />
          </Row>
        );
      })}
    </Section>
  );
}

function Arrow({ dir, disabled, label, onPress, testID }: { dir: -1 | 1; disabled: boolean; label: string; onPress: () => void; testID: string }) {
  const t = useTheme();
  const Icon = dir < 0 ? IconUp : IconDown;
  return (
    <Press onPress={onPress} disabled={disabled} scale={0.85} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} testID={testID}
      style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Icon color={t.ink} size={16} />
    </Press>
  );
}

/** Paar-Bild: ein Foto aus eurem Album als Hintergrund oben auf der Startseite */
function HeroPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const t = useTheme();
  const { items, loaded } = usePhotos();
  const shown = items.slice(0, 30);
  const urls = usePhotoUrls(shown);
  const tile = { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' as const };
  return (
    <Section title="Paar-Bild" footer={items.length ? 'Ein Foto aus eurem Album als Hintergrund oben auf der Startseite.' : loaded ? 'Lege zuerst Fotos ins Album, dann kannst du hier eins auswählen.' : undefined}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
        <Press onPress={() => onChange(null)} scale={0.94} accessibilityRole="radio" accessibilityLabel="Kein Foto, Muster" accessibilityState={{ selected: !value }} testID="hero-none"
          style={[tile, { backgroundColor: '#24346F', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: !value ? t.blue : 'transparent' }]}>
          <T style={{ color: '#FFFFFF', fontFamily: fonts.bodySemi, fontSize: 12 }}>Muster</T>
        </Press>
        {shown.map((p) => {
          const on = value === p.id;
          return (
            <Press key={p.id} onPress={() => onChange(p.id)} scale={0.94} accessibilityRole="radio" accessibilityLabel={p.caption ?? 'Foto'} accessibilityState={{ selected: on }} testID="hero-photo"
              style={[tile, { backgroundColor: t.surface2, borderWidth: 3, borderColor: on ? t.blue : 'transparent' }]}>
              {urls[p.id] ? <Image source={{ uri: urls[p.id], cacheKey: p.id }} style={{ width: '100%', height: '100%' }} contentFit="cover" recyclingKey={p.id} /> : null}
            </Press>
          );
        })}
      </ScrollView>
    </Section>
  );
}
