/**
 * Datum und Uhrzeit wie in der iPhone-Kalender-App: kompakte graue Knöpfe, ein Tipp öffnet das iOS-Rad bzw. den Kalender.
 * Android: System-Dialog. Web (nur Vorschau): Texteingabe.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Switch, Text, View } from 'react-native';

import { fullDate, parse, ymd } from '@/lib/dates';
import { fonts, useTheme } from '@/theme';
import { Divider, Input, Press, T } from '@/ui/kit';

const toTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function timeAsDate(hhmm: string | null) {
  const d = new Date();
  const [h, m] = (hhmm ?? '').split(':').map(Number);
  if (Number.isFinite(h) && Number.isFinite(m)) d.setHours(h, m, 0, 0);
  else d.setHours(new Date().getHours() + 1, 0, 0, 0);
  return d;
}

/** Eine Zeile in einer iOS-Gruppe: Text links, Steuerelement rechts. */
export function FormRow({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <>
      {first ? null : <Divider />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 12 }}>
        <T style={{ fontFamily: 'Figtree_500Medium' }}>{label}</T>
        {children}
      </View>
    </>
  );
}

function Pill({ text, onPress, testID }: { text: string; onPress: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} testID={testID} accessibilityRole="button" style={{ backgroundColor: t.surface2, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 11 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: t.ink }}>{text}</Text>
    </Press>
  );
}

export function DatePicker({ value, onChange, maximumDate, testID }: { value: string; onChange: (iso: string) => void; maximumDate?: Date; testID?: string }) {
  const t = useTheme();
  const date = parse(value);
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker value={date} mode="date" display="compact" locale="de-DE" accentColor={t.blue} themeVariant={t.dark ? 'dark' : 'light'} maximumDate={maximumDate}
        onChange={(_e, d) => d && onChange(ymd(d))} testID={testID} />
    );
  }
  if (Platform.OS === 'android') {
    return <Pill text={fullDate(date)} testID={testID} onPress={() => DateTimePickerAndroid.open({ value: date, mode: 'date', maximumDate, onChange: (e, d) => e.type === 'set' && d && onChange(ymd(d)) })} />;
  }
  // Web-Vorschau
  return (
    <View style={{ width: 150 }}>
      <Input value={value} onChangeText={(v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && onChange(v)} defaultValue={value} testID={testID} />
    </View>
  );
}

export function TimePicker({ value, onChange, testID }: { value: string | null; onChange: (hhmm: string) => void; testID?: string }) {
  const t = useTheme();
  const d = timeAsDate(value);
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker value={d} mode="time" display="compact" locale="de-DE" minuteInterval={5} accentColor={t.blue} themeVariant={t.dark ? 'dark' : 'light'}
        onChange={(_e, x) => x && onChange(toTime(x))} testID={testID} />
    );
  }
  if (Platform.OS === 'android') {
    return <Pill text={`${toTime(d)} Uhr`} testID={testID} onPress={() => DateTimePickerAndroid.open({ value: d, mode: 'time', is24Hour: true, onChange: (e, x) => e.type === 'set' && x && onChange(toTime(x)) })} />;
  }
  return (
    <View style={{ width: 110 }}>
      <Input defaultValue={value ?? toTime(d)} onChangeText={(v) => /^\d{2}:\d{2}$/.test(v) && onChange(v)} testID={testID} />
    </View>
  );
}

/** "Ganztägig"-Schalter wie im iPhone-Kalender. */
export function AllDaySwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel="Ganztägig" testID="ev-allday" />;
}
