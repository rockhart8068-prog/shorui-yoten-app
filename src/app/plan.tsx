import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useBilling } from '@/lib/billing';
import { FREE_DOC_LIMIT } from '@/lib/doc-types';
import { useStore } from '@/lib/store';

/** 有料プランの案内と購入（企画書：月額480円・年額4,800円） */
export default function PlanScreen() {
  const { plan, setPlan } = useStore();
  const billing = useBilling();
  const [message, setMessage] = useState<string | null>(null);

  const buy = async (which: 'monthly' | 'annual') => {
    const pkg = which === 'monthly' ? billing.monthly : billing.annual;
    if (!pkg) return;
    setMessage(null);
    try {
      const ok = await billing.purchase(pkg);
      if (ok) setMessage('有料プランになりました。');
    } catch {
      setMessage('購入できませんでした。時間をおいてもう一度お試しください。');
    }
  };

  const restore = async () => {
    setMessage(null);
    try {
      const ok = await billing.restore();
      setMessage(ok ? '購入を復元しました。' : '復元できる購入は見つかりませんでした。');
    } catch {
      setMessage('復元できませんでした。時間をおいてもう一度お試しください。');
    }
  };

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">いまのプラン：{plan === 'paid' ? '有料' : '無料'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          無料：書類{FREE_DOC_LIMIT}件まで、取り込み・原文つきの要点・やること・期限の通知（3日前）
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          有料：書類の数は無制限、本文の全文検索、前の版との違いの表示、通知の日を選べる
        </ThemedText>
      </Card>

      {billing.available ? (
        plan === 'paid' ? (
          <Notice>有料プランをご利用中です。解約は App Store または Google Play の「サブスクリプション」から行えます。</Notice>
        ) : (
          <Section title="有料プランにする">
            <Button
              label={`月額 ${billing.monthly?.product.priceString ?? '480円'}`}
              onPress={() => buy('monthly')}
              disabled={!billing.monthly || billing.busy}
            />
            <Button
              label={`年額 ${billing.annual?.product.priceString ?? '4,800円'}`}
              onPress={() => buy('annual')}
              disabled={!billing.annual || billing.busy}
            />
            {!billing.monthly && !billing.annual && <Notice>商品の情報を読み込めませんでした。</Notice>}
          </Section>
        )
      ) : (
        <Notice>この環境では課金を使えません（課金のキーが未設定か、ブラウザで動かしています）。</Notice>
      )}

      {message && <Notice>{message}</Notice>}

      {billing.available && <Button label="購入を復元" variant="secondary" onPress={restore} disabled={billing.busy} />}

      <ThemedText type="small" themeColor="textSecondary">
        お支払いは購入の確認時にストアのアカウントに請求されます。期間の終了24時間前までに解約しない限り、同じ期間・同じ料金で自動更新されます。解約はストアの「サブスクリプション」から行えます。
      </ThemedText>

      {!billing.available && __DEV__ && (
        <Section title="開発用：プランの切り替え">
          <View style={styles.chips}>
            <Chip label="無料" selected={plan === 'free'} onPress={() => setPlan('free')} />
            <Chip label="有料" selected={plan === 'paid'} onPress={() => setPlan('paid')} />
          </View>
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
