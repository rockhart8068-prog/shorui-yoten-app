import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DOC_TYPE_LIST, guessDocType } from '@/lib/doc-types';
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
  const [dispute, setDispute] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onTextChange = (t: string) => {
    setText(t);
    setDispute(null);
    if (!type) setType(guessDocType(t));
  };

  const submit = async () => {
    if (!type || !text.trim()) return;
    setBusy(true);
    try {
      const result = await ruleBasedExtractor.extract(text, type);
      if (result.kind === 'dispute') {
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
      router.replace(`/doc/${id}`);
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
            <Button label="カメラで撮影" variant="secondary" disabled onPress={() => {}} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="PDFを選ぶ" variant="secondary" disabled onPress={() => {}} />
          </View>
        </View>
        <Notice>撮影とPDFの読み取りは、AIの読み取りをつなぐ次の版で使えます。今は文字を貼り付けるか、見本を選んでください。</Notice>
        <View style={styles.chips}>
          {SAMPLE_DOCS.map((s) => (
            <Chip
              key={s.title}
              label={s.title}
              selected={title === s.title}
              onPress={() => {
                setTitle(s.title);
                setType(s.type);
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
        {type && (
          <ThemedText type="small" themeColor="textSecondary">
            本文から推定しました。違っていれば選び直してください。
          </ThemedText>
        )}
        <View style={styles.chips}>
          {DOC_TYPE_LIST.map((t) => (
            <Chip key={t.type} label={t.label} selected={type === t.type} onPress={() => setType(t.type)} />
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
