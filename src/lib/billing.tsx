import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { useStore } from './store';

/**
 * 有料プラン（月額480円・年額4,800円）の課金。
 * App Store と Google Play の定期購入を RevenueCat でまとめて扱う。
 * RevenueCat の管理画面で、権利（entitlement）を ENTITLEMENT の名前で作り、月額・年額の商品を current offering に入れる。
 */
export const ENTITLEMENT = 'premium';

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

/** 課金のキーが設定された iPhone/Android でだけ本物の課金を使う */
export const billingAvailable = !!API_KEY;

type Billing = {
  available: boolean;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
  busy: boolean;
  /** 買えたら true。取り消しは false */
  purchase(pkg: PurchasesPackage): Promise<boolean>;
  restore(): Promise<boolean>;
};

const BillingContext = createContext<Billing | null>(null);

const isPaid = (info: CustomerInfo) => info.entitlements.active[ENTITLEMENT] !== undefined;

export function BillingProvider({ children }: { children: ReactNode }) {
  const { setPlan, loaded } = useStore();
  const [monthly, setMonthly] = useState<PurchasesPackage | null>(null);
  const [annual, setAnnual] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!billingAvailable || !loaded) return;
    const apply = (info: CustomerInfo) => setPlan(isPaid(info) ? 'paid' : 'free');
    Purchases.configure({ apiKey: API_KEY! });
    Purchases.addCustomerInfoUpdateListener(apply);
    Purchases.getCustomerInfo().then(apply).catch(() => {});
    Purchases.getOfferings()
      .then((o) => {
        setMonthly(o.current?.monthly ?? null);
        setAnnual(o.current?.annual ?? null);
      })
      .catch(() => {});
    return () => {
      Purchases.removeCustomerInfoUpdateListener(apply);
    };
  }, [loaded, setPlan]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setBusy(true);
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const paid = isPaid(customerInfo);
        setPlan(paid ? 'paid' : 'free');
        return paid;
      } catch (e) {
        if ((e as { userCancelled?: boolean | null }).userCancelled) return false;
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [setPlan],
  );

  const restore = useCallback(async () => {
    setBusy(true);
    try {
      const info = await Purchases.restorePurchases();
      const paid = isPaid(info);
      setPlan(paid ? 'paid' : 'free');
      return paid;
    } finally {
      setBusy(false);
    }
  }, [setPlan]);

  const value = useMemo<Billing>(
    () => ({ available: billingAvailable, monthly, annual, busy, purchase, restore }),
    [monthly, annual, busy, purchase, restore],
  );
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): Billing {
  const b = useContext(BillingContext);
  if (!b) throw new Error('BillingProvider がありません');
  return b;
}
