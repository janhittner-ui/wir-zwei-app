/**
 * Paar-Quiz als kleines Spiel: Abwechselnd bekommt einer von euch eine Frage, beantwortet sie,
 * dann geht es mit „Nächste Frage“ beim anderen weiter. Klappt an einem Handy zusammen
 * oder an zwei Handys (live). Jede Runde hat 20 Fragen aus 1000 (src/lib/quiz-fragen/).
 */
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useQuizAnswers } from '@/data/provider';
import type { QuizAnswer } from '@/data/types';
import { questionById, questionText, quizState } from '@/lib/quiz';
import { QUIZ_TOPICS } from '@/lib/quiz-questions';
import { fonts, personColors, useTheme } from '@/theme';
import { Banner, Button, Card, CardHead, Input, Screen, T } from '@/ui/kit';

export default function Quiz() {
  const t = useTheme();
  const { store, couple, profile } = useApp();
  const { items, setItems, loaded, error, reload } = useQuizAnswers();
  const [round, setRound] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState('');
  const [reveal, setReveal] = useState<QuizAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const members = couple?.members ?? [];
  const ids = useMemo(() => members.map((m) => m.id).sort(), [members]);
  const st = useMemo(() => quizState(items, ids, couple?.id ?? '', round), [items, ids, couple?.id, round]);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.displayName ?? 'Jemand';
  const otherOf = (id: string | null) => members.find((m) => m.id !== id)?.displayName ?? 'Schatz';
  const textFor = (qid: string, player: string | null) => {
    const q = questionById(qid);
    return q ? questionText(q, nameOf(player), otherOf(player)) : 'Frage aus einer älteren Version';
  };
  const colorOf = (id: string | null) => personColors(t, members.find((m) => m.id === id)?.color);
  const alone = members.length < 2;
  const mine = st.player === profile?.id;

  const submit = async (skip: boolean) => {
    if (!st.question || !st.player) return;
    setBusy(true);
    setErr(null);
    try {
      const a = await store.addQuizAnswer({ round: st.round, questionId: st.question.id, player: st.player, answer: skip ? null : answer });
      setItems((l) => (l.some((x) => x.id === a.id) ? l : [...l, a]));
      setAnswer('');
      setReveal(skip ? null : a);
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    } finally {
      setBusy(false);
    }
  };

  const playerColor = colorOf(reveal ? reveal.player : st.player);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View>
          <T v="eyebrow">{st.question || reveal ? `Runde ${st.round} · Frage ${Math.min(st.done + (reveal ? 0 : 1), st.total)} von ${st.total}` : `Runde ${st.round}`}</T>
          <T v="display">Quiz</T>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surface2, overflow: 'hidden' }} accessibilityLabel={`${st.done} von ${st.total} Fragen beantwortet`}>
          <View style={{ width: `${(st.done / Math.max(1, st.total)) * 100}%`, height: 6, backgroundColor: t.blue }} />
        </View>
        {error ? <Banner warn>Das Quiz konnte gerade nicht geladen werden.</Banner> : null}
        {alone && loaded ? <Banner>Allein geht es auch. Spannender wird es, wenn dein Schatz dabei ist: dann seid ihr abwechselnd dran.</Banner> : null}

        {reveal ? (
          <GameCard tone={playerColor} pill={`${nameOf(reveal.player)} hat geantwortet`}>
            <T style={{ fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24 }}>{textFor(reveal.questionId, reveal.player)}</T>
            <Text style={{ fontFamily: fonts.hand, fontSize: 30, lineHeight: 34, color: playerColor.ink }} testID="quiz-reveal">{reveal.answer}</Text>
            <Button title={st.question ? 'Nächste Frage' : 'Weiter'} onPress={() => setReveal(null)} testID="quiz-next" />
          </GameCard>
        ) : st.question && st.player ? (
          <GameCard tone={playerColor} pill={mine ? 'Du bist dran' : `${nameOf(st.player)} ist dran`}>
            {st.question.topic ? <T v="small" testID="quiz-topic">{QUIZ_TOPICS[st.question.topic].emoji} {QUIZ_TOPICS[st.question.topic].label}</T> : null}
            <T style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30 }} testID="quiz-question">
              {questionText(st.question, nameOf(st.player), otherOf(st.player))}
            </T>
            <Input value={answer} onChangeText={setAnswer} multiline maxLength={1000} placeholder={mine ? 'Deine Antwort' : `Antwort von ${nameOf(st.player)}`}
              accessibilityLabel="Antwort" testID="quiz-answer" />
            {!mine ? <T v="small">Ihr spielt an einem Handy? Dann antwortet {nameOf(st.player)} hier. Sonst erscheint die Frage auch bei {nameOf(st.player)}.</T> : null}
            {err ? <Banner warn>{err}</Banner> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Button kind="link" title="Überspringen" onPress={() => submit(true)} disabled={busy} testID="quiz-skip" />
              <Button title="Antworten" busy={busy} disabled={!answer.trim()} onPress={() => submit(false)} testID="quiz-submit" />
            </View>
          </GameCard>
        ) : loaded ? (
          <GameCard tone={{ dot: t.blue, soft: t.blueSoft, ink: t.blue }} pill="Runde geschafft">
            <T style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30 }}>🎉 Runde {st.round} geschafft!</T>
            <T v="muted">Lest euch eure Antworten noch einmal durch. In der nächsten Runde warten {st.total} neue Fragen auf euch.</T>
            <Button title="Neue Runde" onPress={() => setRound(st.round + 1)} testID="quiz-new-round" />
          </GameCard>
        ) : null}

        {st.answers.length ? (
          <Card style={{ gap: 4 }}>
            <CardHead title="Eure Antworten" />
            {st.answers.map((a, i) => (
              <View key={a.id} style={{ gap: 3, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
                <T v="small">{textFor(a.questionId, a.player)}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colorOf(a.player).dot }} />
                  <T style={{ flex: 1, fontFamily: a.answer ? fonts.bodySemi : fonts.body, color: a.answer ? t.ink : t.muted }}>
                    {nameOf(a.player)}: {a.answer ?? 'übersprungen'}
                  </T>
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function GameCard({ tone, pill, children }: { tone: { dot: string; soft: string; ink: string }; pill: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Card style={{ borderWidth: 2, borderColor: tone.dot, gap: 14, paddingVertical: 20 }}>
      <View style={{ alignSelf: 'flex-start', backgroundColor: tone.soft, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: tone.ink }}>{pill}</Text>
      </View>
      {children}
      <View style={{ position: 'absolute', right: 16, top: 12 }} pointerEvents="none">
        <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 64, color: t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>?</Text>
      </View>
    </Card>
  );
}
