import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { C, F } from '../lib/tokens';
import { formatAmount } from '../lib/format';
import { useSettings } from '../store/settings';
import { useBudgets } from '../store/budgets';
import { useTransactions } from '../store/transactions';
import { SMS_SUPPORTED, ensureSmsPermission } from '../sms/reader';
import { scanInboxAndEnqueue } from '../sms/ingest';
import type { Budget } from '../db/budgets';

type PickerKind = null | 'scanDepth' | 'budget';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const budgets = useBudgets((s) => s.budgets);
  const saveBudget = useBudgets((s) => s.save);
  const removeBudget = useBudgets((s) => s.remove);
  const refreshTxs = useTransactions((s) => s.refresh);

  const overall = useMemo(
    () => budgets.find((b) => b.kind === 'overall'),
    [budgets]
  );

  const [picker, setPicker] = useState<PickerKind>(null);
  const [draftAmount, setDraftAmount] = useState('');
  const [draftPct, setDraftPct] = useState('85');

  const onToggleSms = async (v: boolean) => {
    if (!SMS_SUPPORTED) {
      Alert.alert(
        'SMS not available',
        'SMS reading is only supported on Android. iOS does not expose SMS to apps.'
      );
      return;
    }
    if (v) {
      const ok = await ensureSmsPermission();
      if (!ok) {
        Alert.alert(
          'Permission denied',
          'Grant SMS permission in system settings to enable auto-detection.'
        );
        return;
      }
    }
    await settings.setSmsEnabled(v);
  };

  const onRescan = async () => {
    if (!SMS_SUPPORTED) {
      Alert.alert('Unavailable', 'Rescan requires Android.');
      return;
    }
    const ok = await ensureSmsPermission();
    if (!ok) return;
    const since =
      settings.scanDepthDays === -1
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
        : Date.now() - settings.scanDepthDays * 86400000;
    const n = await scanInboxAndEnqueue(since);
    await settings.setLastScan(Date.now());
    Alert.alert('Scan complete', `${n} new SMS enqueued.`);
  };

  const openBudgetEditor = () => {
    setDraftAmount(overall ? String(Math.round(overall.amount / 100)) : '');
    setDraftPct(overall ? String(overall.alert_pct) : '85');
    setPicker('budget');
  };

  const openDepthEditor = () => setPicker('scanDepth');

  const saveOverallBudget = async () => {
    const rupees = parseInt(draftAmount, 10);
    const pct = Math.min(100, Math.max(1, parseInt(draftPct, 10) || 85));
    if (!Number.isFinite(rupees) || rupees <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive rupee amount.');
      return;
    }
    await saveBudget({
      ...(overall ?? {}),
      kind: 'overall',
      amount: rupees * 100,
      alert_pct: pct,
      category: null,
    } as Omit<Budget, 'id'> & { id?: string });
    setPicker(null);
  };

  const clearOverallBudget = async () => {
    if (!overall) {
      setPicker(null);
      return;
    }
    await removeBudget(overall.id);
    setPicker(null);
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset all data',
      'This permanently deletes all transactions, budgets, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const { resetDb } = await import('../db');
            await resetDb();
            await settings.load();
            await refreshTxs();
            Alert.alert('Data cleared', 'All local data has been wiped.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}>
      <Tag style={{ marginBottom: 10 }}>SETTINGS</Tag>
      <T mono style={{ fontSize: 28, letterSpacing: -0.6, marginBottom: 24 }}>
        Your kharcha
      </T>

      {/* DATA */}
      <Section title="DATA">
        <ToggleRow
          label="SMS scanning"
          value={SMS_SUPPORTED && settings.smsEnabled}
          disabled={!SMS_SUPPORTED}
          rightLabel={!SMS_SUPPORTED ? 'iOS N/A' : undefined}
          onChange={onToggleSms}
        />
        <ToggleRow
          label="Review before adding"
          value={settings.manualApprove}
          onChange={settings.setManualApprove}
        />
        <ToggleRow
          label="Auto-categorise"
          value={settings.autoCategorise}
          onChange={settings.setAutoCategorise}
        />
        <PressRow
          label="Scan depth"
          value={settings.scanDepthDays === -1 ? 'Current month' : `${settings.scanDepthDays} days`}
          onPress={openDepthEditor}
          disabled={!SMS_SUPPORTED}
        />
        <PressRow
          label="Rescan inbox"
          value="→"
          onPress={onRescan}
          disabled={!SMS_SUPPORTED}
          last
        />
      </Section>

      {/* BUDGET */}
      <Section title="BUDGET">
        <PressRow
          label="Monthly limit"
          value={overall ? formatAmount(overall.amount) : 'Not set'}
          onPress={openBudgetEditor}
        />
        <PressRow
          label="Alert at"
          value={overall ? `${overall.alert_pct}% used` : '—'}
          onPress={openBudgetEditor}
          last
        />
      </Section>

      {/* ACCOUNT */}
      <Section title="ACCOUNT">
        <StaticRow label="Currency" value="₹ INR" />
        <StaticRow label="Start of month" value="01" />
        <PressRow
          label="Export all data"
          value="→"
          onPress={() =>
            Alert.alert('Export', 'CSV export is coming soon.')
          }
          last
        />
      </Section>

      {/* PRIVACY */}
      <Section title="PRIVACY">
        <StaticRow label="Storage" value="On-device only" on />
        <StaticRow label="Backup" value="Off" />
        <StaticRow label="Analytics" value="Off" />
        <PressRow
          label="Reset all data"
          value="→"
          onPress={confirmReset}
          danger
          last
        />
      </Section>

      {Platform.OS === 'ios' ? (
        <View style={styles.iosNotice}>
          <Icon name="shield" size={14} color={C.text3} />
          <T mono color={C.text3} style={{ fontSize: 11, flex: 1, lineHeight: 16 }}>
            iOS doesn&apos;t allow apps to read SMS. Add expenses manually with the + tab.
          </T>
        </View>
      ) : null}

      <View style={{ alignItems: 'center', marginTop: 30 }}>
        <T
          mono
          color={C.text4}
          style={{ fontSize: 9, letterSpacing: 1.4 }}>
          KHARCHA · V0.1
        </T>
      </View>

      {/* Pickers */}
      <Sheet
        visible={picker === 'scanDepth'}
        title="SCAN DEPTH"
        onClose={() => setPicker(null)}>
        <View style={{ padding: 20, gap: 10 }}>
          <T color={C.text2} style={{ fontSize: 13, lineHeight: 19, marginBottom: 6 }}>
            How far back should we scan your inbox for bank SMS?
          </T>
          {[
            { label: 'Current month', days: -1 },
            { label: '30 days', days: 30 },
            { label: '60 days', days: 60 },
            { label: '90 days', days: 90 },
            { label: '6 months', days: 180 },
          ].map((opt) => {
            const active = String(settings.scanDepthDays) === String(opt.days);
            return (
              <Pressable
                key={opt.days}
                onPress={async () => {
                  await settings.setScanDepthDays(opt.days);
                  setPicker(null);
                }}
                style={[styles.quickChip, active && { borderColor: C.accent }]}>
                <T mono style={{ fontSize: 12, color: active ? C.accent : C.text2 }}>
                  {opt.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <Sheet
        visible={picker === 'budget'}
        title="MONTHLY BUDGET"
        onClose={() => setPicker(null)}>
        <View style={{ padding: 20, gap: 16 }}>
          <View style={styles.field}>
            <Tag style={{ marginBottom: 6 }}>AMOUNT (₹)</Tag>
            <TextInput
              value={draftAmount}
              onChangeText={setDraftAmount}
              keyboardType="number-pad"
              placeholder="45000"
              placeholderTextColor={C.text4}
              style={styles.input}
              selectionColor={C.accent}
            />
          </View>
          <View style={styles.field}>
            <Tag style={{ marginBottom: 6 }}>ALERT AT (%)</Tag>
            <TextInput
              value={draftPct}
              onChangeText={setDraftPct}
              keyboardType="number-pad"
              style={styles.input}
              selectionColor={C.accent}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {overall ? (
              <Button
                label="CLEAR"
                variant="ghost"
                onPress={clearOverallBudget}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              label={overall ? 'UPDATE' : 'SET BUDGET'}
              onPress={saveOverallBudget}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </Sheet>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Tag style={{ marginBottom: 10 }}>{title}</Tag>
      <View style={styles.sectionBox}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  disabled,
  rightLabel,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  rightLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <T style={{ fontSize: 13, color: disabled ? C.text3 : C.text }}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {rightLabel ? (
          <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 1 }}>
            {rightLabel}
          </T>
        ) : null}
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: C.accent, false: C.border2 }}
          thumbColor={C.text}
          ios_backgroundColor={C.border2}
        />
      </View>
    </View>
  );
}

function PressRow({
  label,
  value,
  onPress,
  disabled,
  danger,
  last,
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.row, last ? { borderBottomWidth: 0 } : null]}>
      <T
        style={{
          fontSize: 13,
          color: disabled ? C.text3 : danger ? C.danger : C.text,
        }}>
        {label}
      </T>
      <T
        mono
        style={{
          fontSize: 11,
          color: disabled ? C.text4 : danger ? C.danger : C.text2,
        }}>
        {value}
      </T>
    </Pressable>
  );
}

function StaticRow({
  label,
  value,
  on,
  last,
}: {
  label: string;
  value: string;
  on?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last ? { borderBottomWidth: 0 } : null]}>
      <T style={{ fontSize: 13, color: C.text }}>{label}</T>
      <T
        mono
        style={{
          fontSize: 11,
          color: on ? C.accent : C.text2,
        }}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iosNotice: {
    marginTop: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  field: {
    borderWidth: 1,
    borderColor: C.border2,
    backgroundColor: C.surface,
    padding: 12,
    borderRadius: 2,
  },
  input: {
    color: C.text,
    fontFamily: F.mono,
    fontSize: 16,
    padding: 0,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    backgroundColor: C.surface,
  },
});
