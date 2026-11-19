/** Ein Foto groß ansehen (wischen zum nächsten), Bildunterschrift ändern, löschen. */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyError } from '@/data/errors';
import { useApp, usePhotos } from '@/data/provider';
import type { Photo } from '@/data/types';
import { fullDate } from '@/lib/dates';
import { fonts } from '@/theme';
import { IconPencil, IconTrash, IconX } from '@/ui/icons';
import { Press } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';

const W = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.7)';

export default function FotoAnsicht() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, couple } = useApp();
  const { items, setItems, loaded } = usePhotos();
  const urls = usePhotoUrls(items);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const start = Math.max(0, items.findIndex((p) => p.id === id));
  const [index, setIndex] = useState(start);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const list = useRef<FlatList<Photo>>(null);

  const cur = items[Math.min(index, items.length - 1)];
  const by = useMemo(() => couple?.members.find((m) => m.id === cur?.createdBy), [couple, cur]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/album'));

  const saveCaption = async () => {
    if (!cur) return;
    setErr(null);
    try {
      await store.updatePhotoCaption(cur.id, draft);
      const caption = draft.replace(/\s+/g, ' ').trim() || null;
      setItems((l) => l.map((p) => (p.id === cur.id ? { ...p, caption } : p)));
      setEditing(false);
    } catch (e) {
      setErr(friendlyError(e));
    }
  };

  const remove = () => {
    if (!cur) return;
    Alert.alert('Foto löschen?', 'Das Foto wird für euch beide gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await store.deletePhoto(cur.id);
            const rest = items.filter((p) => p.id !== cur.id);
            setItems(rest);
            if (!rest.length) close();
            else setIndex((i) => Math.min(i, rest.length - 1));
          } catch (e) {
            setErr(friendlyError(e));
          }
        },
      },
    ]);
  };

  const imgH = height - insets.top - insets.bottom - 170;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Press onPress={close} accessibilityLabel="Schließen" testID="photo-close" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <IconX color={W} size={18} />
        </Press>
        <Text style={{ color: DIM, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{items.length ? `${index + 1} von ${items.length}` : ''}</Text>
        <View style={{ width: 40 }} />
      </View>

      {items.length ? (
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => {
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
            setEditing(false);
          }}
          style={{ flexGrow: 0 }}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width, height: imgH }}
              contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}>
              {urls[item.id] ? (
                <Image source={{ uri: urls[item.id], cacheKey: item.id }} style={{ width, height: imgH }} contentFit="contain" transition={150} accessibilityLabel={item.caption ?? 'Foto'} />
              ) : null}
            </ScrollView>
          )}
        />
      ) : loaded ? (
        <Text style={{ color: W, padding: 24, fontFamily: fonts.body }}>Dieses Foto wurde gelöscht.</Text>
      ) : null}

      {cur ? (
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: insets.bottom + 10, gap: 8 }}>
          {editing ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                maxLength={200}
                placeholder="Bildunterschrift"
                placeholderTextColor={DIM}
                returnKeyType="done"
                onSubmitEditing={saveCaption}
                style={{ color: W, fontFamily: fonts.body, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                testID="caption-input"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18 }}>
                <Press onPress={() => setEditing(false)}><Text style={{ color: DIM, fontFamily: fonts.bodySemi, fontSize: 16 }}>Abbrechen</Text></Press>
                <Press onPress={saveCaption} testID="caption-save"><Text style={{ color: W, fontFamily: fonts.bodySemi, fontSize: 16 }}>Fertig</Text></Press>
              </View>
            </View>
          ) : (
            <>
              {cur.caption ? <Text style={{ color: W, fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 23 }}>{cur.caption}</Text> : null}
              <Text style={{ color: DIM, fontFamily: fonts.body, fontSize: 13 }}>
                {fullDate(new Date(cur.createdAt))}{by ? ` · von ${by.displayName}` : ''}
              </Text>
            </>
          )}
          {err ? <Text style={{ color: '#FF9C92', fontFamily: fonts.body, fontSize: 14 }}>{err}</Text> : null}
          {!editing ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
              <Press onPress={() => { setDraft(cur.caption ?? ''); setEditing(true); }} accessibilityRole="button" accessibilityLabel="Bildunterschrift ändern" testID="caption-edit" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <IconPencil color={W} size={20} />
                <Text style={{ color: W, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{cur.caption ? 'Bildunterschrift' : 'Bildunterschrift hinzufügen'}</Text>
              </Press>
              <Press onPress={remove} accessibilityRole="button" accessibilityLabel="Foto löschen" testID="photo-delete" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <IconTrash color={W} size={22} />
              </Press>
            </View>
          ) : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
