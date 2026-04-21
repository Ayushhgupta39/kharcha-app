import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
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
import { getTransaction, type Transaction } from './src/db/transactions';
import { useSettings } from './src/store/settings';
import { useTransactions } from './src/store/transactions';
import { usePending } from './src/store/pending';
import { useBudgets } from './src/store/budgets';
import { useCategories } from './src/store/categories';
import { C } from './src/lib/tokens';

import { OnboardingScreen } from './src/screens/Onboarding';
import { HomeScreen } from './src/screens/Home';
import { LedgerScreen } from './src/screens/Ledger';
import { InsightsScreen } from './src/screens/Insights';
import { SettingsScreen } from './src/screens/Settings';
import { TxDetailScreen } from './src/screens/TxDetail';
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

function Root() {
  const onboarded = useSettings((s) => s.onboarded);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const [tab, setTab] = useState<Tab>('home');
  const [openTxId, setOpenTxId] = useState<string | null>(null);
  const [openTx, setOpenTx] = useState<Transaction | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

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

  // Refresh when Tx is closed so list reflects edits
  useEffect(() => {
    if (openTxId === null) {
      useTransactions.getState().refresh();
    }
  }, [openTxId]);

  const tabContent = useMemo(() => {
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            onOpenTx={setOpenTxId}
            onOpenPending={() => setPendingOpen(true)}
            onGoTxns={() => setTab('txns')}
          />
        );
      case 'txns':
        return <LedgerScreen onOpenTx={setOpenTxId} />;
      case 'stats':
        return <InsightsScreen />;
      case 'settings':
        return <SettingsScreen />;
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

  if (openTx) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TxDetailScreen
          tx={openTx}
          onBack={() => setOpenTxId(null)}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>{tabContent}</View>
      <BottomNav
        active={tab}
        onTab={setTab}
        onAdd={() => setManualOpen(true)}
      />
      <PendingSheet
        visible={pendingOpen}
        onClose={() => setPendingOpen(false)}
      />
      <ManualSheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
      />
    </View>
  );
}
