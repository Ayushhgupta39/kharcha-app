import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { Button } from '../components/Button';
import { C, F } from '../lib/tokens';
import { useCategories } from '../store/categories';
import { useTransactions } from '../store/transactions';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ManualSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const cats = useCategories((s) => s.all);
  const customs = useCategories((s) => s.customs);
  const add = useTransactions((s) => s.add);

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<string>('food');
  const [note, setNote] = useState('');

  const amountNum = Number(amount);
  const valid = amount && amountNum > 0 && merchant.trim().length > 0;

  const reset = () => {
    setAmount('');
    setMerchant('');
    setCategory('food');
    setNote('');
  };

  const save = async () => {
    if (!valid) return;
    await add({
      amount: Math.round(amountNum * 100),
      merchant: merchant.trim(),
      category,
      date: new Date().toISOString(),
      source: 'manual',
      note: note.trim() || null,
      bank: null,
      raw_sms: null,
    });
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={{ height: 60 + insets.top }}
          onPress={onClose}
        />
        <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <T mono weight="600" style={{ fontSize: 11, letterSpacing: 1.4 }}>
              NEW ENTRY
            </T>
            <Pressable onPress={onClose}>
              <Icon name="x" size={18} color={C.text2} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: 20,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Amount */}
            <Tag style={{ marginBottom: 10 }}>AMOUNT</Tag>
            <View style={styles.amountRow}>
              <T
                mono
                color={amount ? C.text3 : C.text4}
                style={{ fontSize: 32 }}>
                ₹
              </T>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={C.text4}
                keyboardType="decimal-pad"
                autoFocus
                selectionColor={C.accent}
                style={[
                  styles.amountInput,
                  { color: amount ? C.text : C.text4 },
                ]}
              />
            </View>

            {/* Merchant */}
            <Tag style={{ marginBottom: 10, marginTop: 22 }}>MERCHANT</Tag>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Where did you spend?"
              placeholderTextColor={C.text3}
              style={styles.textInput}
              selectionColor={C.accent}
            />

            {/* Category */}
            <Tag style={{ marginBottom: 10, marginTop: 22 }}>CATEGORY</Tag>
            <View style={styles.catGrid}>
              {cats.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[
                      styles.catCell,
                      {
                        borderColor: active ? C.accent : C.border2,
                        backgroundColor: active ? C.accentGlow : C.surface,
                      },
                    ]}>
                    <CategoryGlyph
                      category={c.key}
                      size={22}
                      active={active}
                      customs={customs}
                    />
                    <T style={{ fontSize: 12 }}>{c.label.split(' ')[0]}</T>
                  </Pressable>
                );
              })}
            </View>

            {/* Note */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 22,
                marginBottom: 10,
              }}>
              <Tag>NOTE</Tag>
              <Tag color={C.text4}>(OPTIONAL)</Tag>
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Dinner with team"
              placeholderTextColor={C.text3}
              style={styles.textInput}
              selectionColor={C.accent}
            />
          </ScrollView>

          <View style={styles.actionBar}>
            <Button
              label="CANCEL"
              variant="ghost"
              onPress={() => {
                reset();
                onClose();
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="SAVE ENTRY"
              onPress={save}
              disabled={!valid}
              style={{ flex: 2, opacity: valid ? 1 : 0.35 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    flex: 1,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border2,
    paddingBottom: 12,
  },
  amountInput: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 40,
    letterSpacing: -1,
    padding: 0,
  },
  textInput: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontFamily: F.inter,
    fontSize: 13,
    borderRadius: 2,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catCell: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
});
