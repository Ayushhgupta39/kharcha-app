import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tag } from '../components/Text';
import { Button, Hair } from '../components/Button';
import { C } from '../lib/tokens';
import { ensureSmsPermission, SMS_SUPPORTED } from '../sms/reader';
import { scanInboxAndEnqueue } from '../sms/ingest';
import { useSettings } from '../store/settings';
import { usePending } from '../store/pending';
import { useTransactions } from '../store/transactions';
import { ArrowLeft, Check, Edit, Lock, Shield, X } from 'lucide-react-native';

type Step = 0 | 1 | 2 | 3;

type Props = { onDone: () => void };

const DEPTH_OPTIONS = [
  { label: 'Current month', days: -1 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
];

export function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [found, setFound] = useState(0);
  const insets = useSafeAreaInsets();

  const handleAllow = async () => {
    setScanning(true);
    setStep(3);
    if (SMS_SUPPORTED) {
      const ok = await ensureSmsPermission();
      await useSettings.getState().setSmsEnabled(ok);
      if (ok) {
        const { scanDepthDays } = useSettings.getState();
        const since =
          scanDepthDays === -1
            ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
            : Date.now() - scanDepthDays * 24 * 3600 * 1000;
        const res = await scanInboxAndEnqueue(since);
        setScanned(res.scanned);
        setFound(res.enqueued);
        await useSettings.getState().setLastScan(Date.now());
        await usePending.getState().refresh();
        await useTransactions.getState().refresh();
      }
    } else {
      await useSettings.getState().setSmsEnabled(false);
    }
    setScanning(false);
    setTimeout(async () => {
      await useSettings.getState().setOnboarded(true);
      onDone();
    }, 1200);
  };

  const handleManualOnly = async () => {
    await useSettings.getState().setSmsEnabled(false);
    await useSettings.getState().setOnboarded(true);
    onDone();
  };

  const paddingTop = insets.top + 32;
  const paddingBottom = Math.max(insets.bottom, 20);

  // Step 0 — intro
  if (step === 0) {
    return (
      <View style={[styles.page, { paddingTop, paddingBottom }]}>
        <View style={styles.logoRow}>
          <View style={styles.logoSquare}>
            <T mono weight="700" style={{ color: '#0A0A0A', fontSize: 16 }}>K</T>
          </View>
          <T mono weight="600" style={{ fontSize: 13, letterSpacing: 1.3 }}>KHARCHA</T>
        </View>

        <View style={{ flex: 1 }}>
          <Tag style={{ marginBottom: 14 }}>01 / INTRODUCTION</Tag>
          <T style={{ fontSize: 36, lineHeight: 38, letterSpacing: -0.8, marginBottom: 24 }}>
            Expenses.{'\n'}
            <T style={{ fontSize: 36, color: C.text3 }}>Without{'\n'}</T>
            <T style={{ fontSize: 36, color: C.text3 }}>the spreadsheet.</T>
          </T>

          <Hair style={{ marginVertical: 28 }} />

          <View style={{ gap: 18 }}>
            {[
              ['01', 'Reads bank SMS', 'on-device, nothing leaves your phone'],
              ['02', 'Auto-categorises', 'edit anytime with one tap'],
              ['03', 'No cloud, no login', 'your money, your machine'],
            ].map(([n, h, s]) => (
              <View key={n} style={{ flexDirection: 'row', gap: 14 }}>
                <T mono color={C.text4} style={{ fontSize: 11, paddingTop: 2 }}>{n}</T>
                <View style={{ flex: 1 }}>
                  <T weight="500" style={{ fontSize: 14, marginBottom: 2 }}>{h}</T>
                  <T color={C.text3} style={{ fontSize: 12 }}>{s}</T>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Button label="GET STARTED →" onPress={() => setStep(1)} />
      </View>
    );
  }

  // Step 1 — preferences (approve mode + scan depth)
  if (step === 1) {
    return <PreferencesStep onBack={() => setStep(0)} onNext={() => setStep(2)} />;
  }

  // Step 2 — permission
  if (step === 2) {
    return (
      <View style={[styles.page, { paddingTop, flex: 1 }]}>
        <Pressable
          onPress={() => setStep(1)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          <ArrowLeft size={16} color={C.text3} />
          <T mono color={C.text3} style={{ fontSize: 11, letterSpacing: 1.2 }}>BACK</T>
        </Pressable>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <Tag style={{ marginBottom: 14 }}>03 / PERMISSION</Tag>
          <T style={{ fontSize: 30, lineHeight: 33, letterSpacing: -0.6, marginBottom: 18 }}>
            {SMS_SUPPORTED ? 'Allow SMS read access' : 'SMS read\nnot available on iOS'}
          </T>
          <T color={C.text2} style={{ fontSize: 14, lineHeight: 21 }}>
            {SMS_SUPPORTED
              ? 'Kharcha parses transaction alerts from your bank — nothing else. Messages never leave your device.'
              : 'Apple does not allow apps to read SMS. Until that changes, Kharcha on iOS relies on manual entries — still fully on-device, still no login.'}
          </T>

          {SMS_SUPPORTED ? (
            <View style={styles.infoBox}>
              <View style={styles.infoHeader}>
                <Shield size={16} color={C.accent} />
                <Tag color={C.accent}>WHAT WE ACCESS</Tag>
              </View>
              <View style={{ gap: 10 }}>
                {(
                  [
                    ['Sender ID (HDFC, ICICI, AXIS…)', true],
                    ['Debit amount and merchant', true],
                    ['Transaction date & time', true],
                    ['Personal messages & OTPs', false],
                    ['Contacts or media', false],
                  ] as [string, boolean][]
                ).map(([l, y]) => (
                  <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {y ? (
                      <Check size={14} color={C.accent} strokeWidth={2} />
                    ) : (
                      <X size={14} color={C.text4} strokeWidth={2} />
                    )}
                    <T
                      color={y ? C.text : C.text4}
                      style={{ fontSize: 12, textDecorationLine: y ? 'none' : 'line-through' }}>
                      {l}
                    </T>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <View style={styles.infoHeader}>
                <Edit size={16} color={C.accent} />
                <Tag color={C.accent}>WHAT YOU CAN DO ON iOS</Tag>
              </View>
              <View style={{ gap: 10 }}>
                {[
                  'Add expenses manually — fast keypad flow',
                  'Categorise with one tap, create custom ones',
                  'Daily / monthly / yearly / custom views',
                  'Set overall & per-category budgets',
                ].map((l) => (
                  <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Check size={14} color={C.accent} strokeWidth={2} />
                    <T color={C.text} style={{ fontSize: 12 }}>{l}</T>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.lockRow}>
            <Lock size={16} color={C.text3} />
            <T color={C.text2} style={{ fontSize: 11, lineHeight: 16, flex: 1 }}>
              All parsing runs locally. No servers. No analytics.{' '}
              <T color={C.text3} style={{ fontSize: 11 }}>Works offline.</T>
            </T>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: paddingBottom }]}>
          <Button
            label={SMS_SUPPORTED ? 'ALLOW & CONTINUE' : 'CONTINUE'}
            onPress={SMS_SUPPORTED ? handleAllow : handleManualOnly}
          />
        </View>
      </View>
    );
  }

  // Step 3 — scanning / done
  return (
    <View
      style={[
        styles.page,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28, overflow: 'hidden', position: 'relative' },
      ]}>
      {scanning && SMS_SUPPORTED ? <ScanLine /> : null}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Tag style={{ marginBottom: 14 }}>{scanning ? '04 / SCANNING' : '04 / READY'}</Tag>
        {!scanning ? (
          <>
            <T style={{ fontSize: 32, lineHeight: 34, letterSpacing: -0.6, marginBottom: 24 }}>
              All set.
            </T>
            <View style={{ gap: 10 }}>
              {(SMS_SUPPORTED
                ? ([
                    [scanned, 'messages scanned'],
                    [found, 'transactions found'],
                  ] as [number, string][])
                : ([[0, 'ready to log expenses']] as [number, string][])
              ).map(([n, l]) => (
                <View
                  key={l}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border,
                    paddingBottom: 10,
                  }}>
                  <T mono color={C.accent} style={{ fontSize: 28, minWidth: 56 }}>
                    {String(n).padStart(2, '0')}
                  </T>
                  <T color={C.text2} style={{ fontSize: 13 }}>{l}</T>
                </View>
              ))}
            </View>
          </>
        ) : (
          <ScanningAnim />
        )}
      </View>
    </View>
  );
}

function PreferencesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [manualApprove, setManualApprove] = useState(settings.manualApprove);
  const [depthIdx, setDepthIdx] = useState(() => {
    const i = DEPTH_OPTIONS.findIndex((o) => o.days === settings.scanDepthDays);
    return i >= 0 ? i : 2; // default 90d
  });

  const handleNext = async () => {
    await settings.setManualApprove(manualApprove);
    await settings.setScanDepthDays(DEPTH_OPTIONS[depthIdx].days);
    onNext();
  };

  return (
    <View style={[styles.page, { flex: 1 }]}>
      <Pressable
        onPress={onBack}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40, marginTop: insets.top + 32 }}>
        <ArrowLeft size={16} color={C.text3} />
        <T mono color={C.text3} style={{ fontSize: 11, letterSpacing: 1.2 }}>BACK</T>
      </Pressable>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <Tag style={{ marginBottom: 14 }}>02 / PREFERENCES</Tag>
        <T style={{ fontSize: 30, lineHeight: 33, letterSpacing: -0.6, marginBottom: 8 }}>
          How should we handle transactions?
        </T>
        <T color={C.text3} style={{ fontSize: 13, lineHeight: 19, marginBottom: 28 }}>
          You can change these anytime in Settings.
        </T>

        {/* Approve mode */}
        <T mono weight="600" color={C.text3} style={{ fontSize: 10, letterSpacing: 1.2, marginBottom: 10 }}>
          TRANSACTION MODE
        </T>
        <View style={{ gap: 8, marginBottom: 32 }}>
          {[
            {
              value: false,
              title: 'Auto-add',
              desc: 'Transactions are added directly. Fastest experience.',
            },
            {
              value: true,
              title: 'Review first',
              desc: 'Each transaction waits in a queue for you to approve or dismiss.',
            },
          ].map((opt) => {
            const active = manualApprove === opt.value;
            return (
              <Pressable
                key={String(opt.value)}
                onPress={() => setManualApprove(opt.value)}
                style={[styles.optionCard, active && styles.optionCardActive]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <T weight="500" style={{ fontSize: 14, color: active ? C.text : C.text2 }}>
                    {opt.title}
                  </T>
                  {active ? <Check size={14} color={C.accent} strokeWidth={2.5} /> : null}
                </View>
                <T color={C.text3} style={{ fontSize: 12, lineHeight: 17 }}>{opt.desc}</T>
              </Pressable>
            );
          })}
        </View>

        {/* Scan depth */}
        <T mono weight="600" color={C.text3} style={{ fontSize: 10, letterSpacing: 1.2, marginBottom: 10 }}>
          SCAN DEPTH
        </T>
        <T color={C.text3} style={{ fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
          How far back should we look for bank SMS on first scan?
        </T>
        <View style={{ gap: 8, marginBottom: 32 }}>
          {DEPTH_OPTIONS.map((opt, i) => {
            const active = depthIdx === i;
            return (
              <Pressable
                key={i}
                onPress={() => setDepthIdx(i)}
                style={[styles.depthRow, active && styles.depthRowActive]}>
                <T style={{ fontSize: 13, color: active ? C.text : C.text2 }}>{opt.label}</T>
                {active ? <Check size={14} color={C.accent} strokeWidth={2.5} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Button label="NEXT →" onPress={handleNext} />
      </View>
    </View>
  );
}

function ScanningAnim() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((v) => Math.min(47, v + Math.ceil(Math.random() * 5))), 90);
    return () => clearInterval(iv);
  }, []);
  return (
    <View style={{ gap: 14 }}>
      <T style={{ fontSize: 28, lineHeight: 30, letterSpacing: -0.6, marginBottom: 32 }}>
        Scanning your inbox…
      </T>
      <T mono style={{ fontSize: 48, color: C.text, lineHeight: 48 }}>
        {String(n).padStart(3, '0')}
        <T mono color={C.text4} style={{ fontSize: 48 }}>{' '}/ 047</T>
      </T>
      <View style={{ height: 2, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${(n / 47) * 100}%`, backgroundColor: C.accent }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T mono color={C.text3} style={{ fontSize: 11 }}>
          PARSING {Platform.OS === 'android' ? 'HDFC · ICICI · AXIS' : ''}
        </T>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
      </View>
    </View>
  );
}

function ScanLine() {
  const y = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(y, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  const translate = y.interpolate({ inputRange: [-1, 1], outputRange: ['-100%', '100%'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        transform: [{ translateY: translate as unknown as number }],
      }}>
      <View style={{ height: '100%', backgroundColor: 'rgba(212,255,79,0.08)' }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 48,
  },
  logoSquare: {
    width: 28,
    height: 28,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: C.border2,
    padding: 20,
    marginTop: 28,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  lockRow: {
    marginTop: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 14,
    backgroundColor: C.surface,
  },
  optionCardActive: {
    borderColor: C.accent,
  },
  depthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  depthRowActive: {
    borderColor: C.accent,
  },
  bottomBar: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
});
