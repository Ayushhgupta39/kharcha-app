import { useEffect, useRef, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, BackHandler, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { getDb } from './src/db';
import { scanInboxAndEnqueue } from './src/sms/ingest';
import { SMS_SUPPORTED } from './src/sms/reader';
import { getTransaction, type Transaction } from './src/db/transactions';
import type { Account } from './src/db/accounts';
import { useSettings } from './src/store/settings';
import { useTransactions } from './src/store/transactions';
import { usePending } from './src/store/pending';
import { useBudgets } from './src/store/budgets';
import { useCategories } from './src/store/categories';
import { useAccounts } from './src/store/accounts';
import { C } from './src/lib/tokens';

import { OnboardingScreen } from './src/screens/Onboarding';
import { HomeScreen } from './src/screens/Home';
import { LedgerScreen } from './src/screens/Ledger';
import { InsightsScreen } from './src/screens/Insights';
import { SettingsScreen } from './src/screens/Settings';
import { PortfolioScreen } from './src/screens/Portfolio';
import { AccountDetailScreen } from './src/screens/AccountDetail';
import { TxDetailScreen } from './src/screens/TxDetail';
import { CategorySheet } from './src/screens/CategorySheet';
import { MerchantSheet } from './src/screens/MerchantSheet';
import { PendingSheet } from './src/screens/PendingSheet';
import { ManualSheet } from './src/screens/ManualSheet';
import { BottomNav, type Tab } from './src/components/BottomNav';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await getDb();
      await Promise.all([
        useSettings.getState().load(),
        useCategories.getState().refresh(),
        useTransactions.getState().refresh(),
        usePending.getState().refresh(),
        useBudgets.getState().refresh(),
        useAccounts.getState().refresh(),
      ]);
      setDbReady(true);
    })();
  }, []);

  if (!fontsLoaded || !dbReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

async function runSmsSync() {
  if (!SMS_SUPPORTED) return;
  const settings = useSettings.getState();
  if (!settings.smsEnabled) return;
  const since = settings.lastScanEpoch || Date.now() - 90 * 24 * 60 * 60 * 1000;
  await scanInboxAndEnqueue(since);
  await settings.setLastScan(Date.now());
  await useTransactions.getState().refresh();
  await usePending.getState().refresh();
}

function useSmsSync() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    runSmsSync();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        runSmsSync();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);
}

function Root() {
  const onboarded = useSettings((s) => s.onboarded);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const [tab, setTab] = useState<Tab>('home');
  const [openTxId, setOpenTxId] = useState<string | null>(null);
  const [openTx, setOpenTx] = useState<Transaction | null>(null);
  const [openCategory, setOpenCategory] = useState<{ key: string; txs: Transaction[] } | null>(
    null
  );
  const [openMerchant, setOpenMerchant] = useState<{ name: string; txs: Transaction[] } | null>(
    null
  );
  const [openAccount, setOpenAccount] = useState<Account | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useSmsSync();

  useEffect(() => {
    if (!openTxId) {
      setOpenTx(null);
      return;
    }
    (async () => {
      const tx = await getTransaction(openTxId);
      setOpenTx(tx);
    })();
  }, [openTxId]);

  useEffect(() => {
    if (openTxId === null) {
      useTransactions.getState().refresh();
    }
  }, [openTxId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openTxId) {
        setOpenTxId(null);
        return true;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (openAccount) {
        setOpenAccount(null);
        return true;
      }
      if (openCategory) {
        setOpenCategory(null);
        return true;
      }
      if (openMerchant) {
        setOpenMerchant(null);
        return true;
      }
      if (pendingOpen) {
        setPendingOpen(false);
        return true;
      }
      if (manualOpen) {
        setManualOpen(false);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [
    openTxId,
    settingsOpen,
    openAccount,
    openCategory,
    openMerchant,
    pendingOpen,
    manualOpen,
    tab,
  ]);

  const tabContent = useMemo(() => {
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            onOpenTx={setOpenTxId}
            onOpenPending={() => setPendingOpen(true)}
            onGoTxns={() => setTab('txns')}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        );
      case 'txns':
        return <LedgerScreen onOpenTx={setOpenTxId} />;
      case 'stats':
        return (
          <InsightsScreen
            onOpenCategory={(key, txs) => {
              const sorted = [...txs].sort((a, b) => b.amount - a.amount);
              setOpenCategory({ key, txs: sorted });
            }}
            onOpenMerchant={(name, txs) => {
              const sorted = [...txs].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
              );
              setOpenMerchant({ name, txs: sorted });
            }}
          />
        );
      case 'portfolio':
        return (
          <PortfolioScreen
            onOpenAccount={setOpenAccount}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        );
    }
  }, [tab]);

  if (!onboarded) {
    return (
      <OnboardingScreen
        onDone={async () => {
          await setOnboarded(true);
        }}
      />
    );
  }

  const overlay = openTx ? (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TxDetailScreen tx={openTx} onBack={() => setOpenTxId(null)} />
    </View>
  ) : settingsOpen ? (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SettingsScreen onBack={() => setSettingsOpen(false)} />
    </View>
  ) : openAccount ? (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AccountDetailScreen
        account={openAccount}
        onBack={() => setOpenAccount(null)}
        onOpenTx={setOpenTxId}
      />
    </View>
  ) : openCategory ? (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <CategorySheet
        category={openCategory.key}
        txs={openCategory.txs}
        onBack={() => setOpenCategory(null)}
        onOpenTx={setOpenTxId}
      />
    </View>
  ) : openMerchant ? (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <MerchantSheet
        merchant={openMerchant.name}
        txs={openMerchant.txs}
        onBack={() => setOpenMerchant(null)}
        onOpenTx={setOpenTxId}
      />
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, display: overlay ? 'none' : 'flex' }}>{tabContent}</View>
      {overlay ? (
        <View style={{ flex: 1 }}>{overlay}</View>
      ) : (
        <>
          <BottomNav active={tab} onTab={setTab} onAdd={() => setManualOpen(true)} />
          <PendingSheet visible={pendingOpen} onClose={() => setPendingOpen(false)} />
          <ManualSheet visible={manualOpen} onClose={() => setManualOpen(false)} />
        </>
      )}
    </View>
  );
}
