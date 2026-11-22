import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DOC_TYPE_LIST, FREE_DOC_LIMIT, guessDocType } from '@/lib/doc-types';
import { aiAvailable, aiErrorMessage, aiExtractor, readDocument, type ReadFile } from '@/lib/ai';
import { CaptureError, pickPdf, pickPhotos, takePhoto } from '@/lib/capture';
import { ruleBasedExtractor } from '@/lib/extractor';
import { CONSULT_CONTACTS } from '@/lib/rules';
import { SAMPLE_DOCS } from '@/lib/samples';
import { useStore } from '@/lib/store';
import type { DocType } from '@/lib/types';

/** 画面2 取り込み：撮影・PDF選択と種類の確定 */
export default function ImportScreen() {
  const theme = useTheme();
  const { addDocument, canAddDocument } = useStore();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocType | null>(null);
  // 種類を利用者が選んだか（見本を選んだときも含む）。選ぶまでは本文が変わるたびに推定し直す
  const [typeChosen, setTypeChosen] = useState(false);
  const [dispute, setDispute] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 撮影・選んだページ（読み取り前）
  const [pages, setPages] = useState<ReadFile[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_PAGES = 10;
  const addPages = async (get: () => Promise<ReadFile[]>) => {
    setError(null);
    try {
      const added = await get();
      setPages((p) => [...p, ...added].slice(0, MAX_PAGES));
    } catch (e) {
      if (e instanceof CaptureError) {
        setError(e.code === 'permission' ? 'カメラの使用が許可されていません。設定アプリから許可してください。' : 'PDFが大きすぎます（12MBまで）。');
      } else {
        setError('読み込めませんでした。');
      }
    }
  };

  const read = async () => {
    if (pages.length === 0) return;
    setReading(true);
    setError(null);
    try {
      const t = await readDocument(pages);
      setPages([]);
      onTextChange(t);
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setReading(false);
    }
  };

  const onTextChange = (t: string) => {
    setText(t);
    setDispute(null);
    // 見本を選んだあとに別の文を貼り付けたら、見本の題名を引き継がない
    const sample = SAMPLE_DOCS.find((x) => x.title === title);
    if (sample && sample.text !== t) {
      setTitle('');
      setTypeChosen(false);
      setType(guessDocType(t));
      return;
    }
    if (!typeChosen) setType(guessDocType(t));
  };

  const submit = async () => {
    if (!type || !text.trim()) return;
    setBusy(true);
    try {
      setError(null);
      const extractor = aiAvailable ? aiExtractor : ruleBasedExtractor;
      let result;
      try {
        result = await extractor.extract(text, type);
      } catch (e) {
        setError(aiErrorMessage(e));
        return;
      }
      if (result.kind === 'dispute') {
        // もめごとの書類は保存も要点化もしない（ルール4）
        setDispute(result.matched);
        return;
      }
      const id = addDocument({
        type,
        title: title.trim() || text.trim().split('\n')[0].slice(0, 30),
        counterparty: result.counterparty,
        text,
        fields: result.fields,
        tasks: result.tasks,
      });
      if (id) router.replace(`/doc/${id}`);
    } finally {
      setBusy(false);
    }
  };

  if (dispute) {
    return (
      <Screen>
        <Card>
          <ThemedText type="smallBold">この書類は要点化しません</ThemedText>
          <ThemedText type="small">
            「{dispute}」という言葉があり、相手方ともめごとになっている書類の可能性があります。アプリでは内容の整理をせず、次の相談先をご案内しています。
          </ThemedText>
        </Card>
        {CONSULT_CONTACTS.map((c) => (
          <Card key={c.name} onPress={() => Linking.openURL(c.url)}>
            <ThemedText type="smallBold">{c.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {c.detail}
            </ThemedText>
          </Card>
        ))}
        <Button label="戻る" variant="secondary" onPress={() => setDispute(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Section title="1. 書類を読み取る">
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button
              label="カメラで撮影"
              variant="secondary"
              disabled={!aiAvailable || reading || pages.length >= MAX_PAGES}
              onPress={() => addPages(async () => {
                const p = await takePhoto();
                return p ? [p] : [];
              })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="写真から選ぶ"
              variant="secondary"
              disabled={!aiAvailable || reading || pages.length >= MAX_PAGES}
              onPress={() => addPages(() => pickPhotos(MAX_PAGES - pages.length))}
            />
          </View>
        </View>
        <Button
          label="PDFを選ぶ"
          variant="secondary"
          disabled={!aiAvailable || reading || pages.length > 0}
          onPress={() => addPages(async () => {
            const p = await pickPdf();
            return p ? [p] : [];
          })}
        />
        {pages.length > 0 && (
          <Card>
            <ThemedText type="small">
              {pages[0].mediaType === 'application/pdf' ? 'PDF 1件' : `${pages.length}ページ撮影済み`}
              。続けて撮影すると次のページになります。
            </ThemedText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button label={reading ? '読み取り中…' : '文字を読み取る'} onPress={read} disabled={reading} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="撮り直す" variant="secondary" onPress={() => setPages([])} disabled={reading} />
              </View>
            </View>
          </Card>
        )}
        {!aiAvailable && (
          <Notice>撮影とPDFの読み取りには、AIの中継サーバーの設定が必要です（開発中）。今は文字を貼り付けるか、見本を選んでください。</Notice>
        )}
        {error && <Notice>{error}</Notice>}
        <ThemedText type="small" themeColor="textSecondary">
          読み取った文字は下に入ります。読み違いがあれば直してから「要点を見る」を押してください。
        </ThemedText>
        <View style={styles.chips}>
          {SAMPLE_DOCS.map((s) => (
            <Chip
              key={s.title}
              label={s.title}
              selected={title === s.title}
              onPress={() => {
                setTitle(s.title);
                setType(s.type);
                setTypeChosen(true);
                setText(s.text);
                setDispute(null);
              }}
            />
          ))}
        </View>
        <TextInput
          value={text}
          onChangeText={onTextChange}
          multiline
          placeholder="読み取った文字（ここに貼り付けもできます）"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, styles.body, { color: theme.text, borderColor: theme.border }]}
        />
      </Section>

      <Section title="2. 種類を確かめる">
        {type && !typeChosen && (
          <ThemedText type="small" themeColor="textSecondary">
            本文から推定しました。違っていれば選び直してください。
          </ThemedText>
        )}
        <View style={styles.chips}>
          {DOC_TYPE_LIST.map((t) => (
            <Chip
              key={t.type}
              label={t.label}
              selected={type === t.type}
              onPress={() => {
                setType(t.type);
                setTypeChosen(true);
              }}
            />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          この4種類以外の書類と保険証券には、まだ対応していません。
        </ThemedText>
      </Section>

      <Section title="3. 名前をつける（任意）">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="例：アパートの契約書"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
      </Section>

      {!canAddDocument && (
        <Notice>無料プランで保管できるのは{FREE_DOC_LIMIT}件までです。書類を削除するか、有料プランにすると取り込めます。</Notice>
      )}
      <Button label={busy ? '読み取り中…' : '要点を見る'} onPress={submit} disabled={!type || !text.trim() || busy || !canAddDocument} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  body: { minHeight: 180, textAlignVertical: 'top' },
});
