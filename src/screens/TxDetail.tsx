import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { Button, Hair } from '../components/Button';
import { C, F } from '../lib/tokens';
import { formatAmount, formatTime } from '../lib/format';
import { getCategory } from '../lib/categories';
import { useCategories } from '../store/categories';
import { useTransactions } from '../store/transactions';
import type { Transaction } from '../db/transactions';

type Props = {
  tx: Transaction;
  onBack: () => void;
};

export function TxDetailScreen({ tx, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const cats = useCategories((s) => s.all);
  const customs = useCategories((s) => s.customs);
  const [note, setNote] = useState(tx.note ?? '');
  const [category, setCategory] = useState(tx.category);
  const [showCat, setShowCat] = useState(false);
  const dirty = note !== (tx.note ?? '') || category !== tx.category;

  const handleSave = async () => {
    await useTransactions
      .getState()
      .update(
        tx.id,
        { note, category },
        { rememberMerchantCategory: category !== tx.category }
      );
    onBack();
  };

  const handleDelete = async () => {
    await useTransactions.getState().remove(tx.id);
    onBack();
  };

  const d = parseISO(tx.date);
  const dateLine = format(d, 'EEEE, dd MMMM yyyy').toUpperCase();
  const catInfo = getCategory(category, customs);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable
          onPress={onBack}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
          <Icon name="arrow-l" size={18} color={C.text} />
          <T mono style={{ fontSize: 11, letterSpacing: 1.2 }}>
            BACK
          </T>
        </Pressable>
        <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 1.3 }}>
          TXN · {tx.id.slice(0, 8).toUpperCase()}
        </T>
        <Pressable onPress={handleDelete}>
          <Icon name="trash" size={16} color={C.text3} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 }}>
          <Tag style={{ marginBottom: 10 }}>
            {tx.category === 'transfer' ? 'TRANSFER' : 'DEBITED'}
          </Tag>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <T mono color={C.text3} style={{ fontSize: 36, marginRight: 4 }}>
              ₹
            </T>
            <T
              mono
              style={{
                fontSize: 56,
                lineHeight: 54,
                letterSpacing: -1.6,
                color: C.text,
              }}>
              {Math.round(tx.amount / 100).toLocaleString('en-IN')}
            </T>
          </View>
          <T style={{ fontSize: 16, color: C.text, marginTop: 14 }}>
            {tx.merchant}
          </T>
          <T
            mono
            color={C.text3}
            style={{ fontSize: 11, marginTop: 4, letterSpacing: 0.3 }}>
            {dateLine} · {formatTime(tx.date)}
          </T>
        </View>

        <Hair />

        {/* Category */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
            <Tag>CATEGORY</Tag>
            <Pressable
              onPress={() => setShowCat((v) => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
              <T
                mono
                color={C.accent}
                style={{ fontSize: 10, letterSpacing: 1.3 }}>
                {showCat ? 'DONE' : 'CHANGE'}
              </T>
              <Icon
                name={showCat ? 'chevron-d' : 'chevron-r'}
                size={12}
                color={C.accent}
              />
            </Pressable>
          </View>
          <View style={styles.catBox}>
            <CategoryGlyph
              category={category}
              size={42}
              active
              customs={customs}
            />
            <View>
              <T weight="500" style={{ fontSize: 14 }}>
                {catInfo.label}
              </T>
              {tx.source === 'sms' && !showCat ? (
                <T
                  mono
                  color={C.text3}
                  style={{ fontSize: 10, marginTop: 2 }}>
                  AUTO-DETECTED
                </T>
              ) : null}
            </View>
          </View>
          {showCat ? (
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
                        backgroundColor: active
                          ? C.accentGlow
                          : C.surface,
                        borderColor: active ? C.accent : C.border2,
                      },
                    ]}>
                    <CategoryGlyph
                      category={c.key}
                      size={24}
                      active={active}
                      customs={customs}
                    />
                    <T style={{ fontSize: 12 }}>{c.label}</T>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <Hair />

        {/* Source */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
          <Tag style={{ marginBottom: 12 }}>SOURCE</Tag>
          {tx.source === 'sms' ? (
            <View style={styles.smsBox}>
              <View style={styles.smsHeader}>
                <Icon name="sms" size={14} color={C.accent} />
                <T
                  mono
                  color={C.text2}
                  style={{ fontSize: 10, letterSpacing: 1.3 }}>
                  SMS {tx.bank ? '· ' + tx.bank : ''}
                </T>
                <View style={{ flex: 1 }} />
                <T mono color={C.text4} style={{ fontSize: 10 }}>
                  {formatTime(tx.date)}
                </T>
              </View>
              <View style={{ padding: 14 }}>
                <T
                  mono
                  color={C.text2}
                  style={{ fontSize: 12, lineHeight: 18 }}>
                  {tx.raw_sms || 'Original SMS content not available.'}
                </T>
              </View>
            </View>
          ) : (
            <View style={styles.manualBox}>
              <Icon name="edit" size={14} color={C.text2} />
              <T
                mono
                color={C.text2}
                style={{ fontSize: 11, letterSpacing: 1.2 }}>
                MANUAL ENTRY
              </T>
            </View>
          )}
        </View>

        {/* Note */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Tag style={{ marginBottom: 12 }}>NOTE</Tag>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note…"
            placeholderTextColor={C.text3}
            multiline
            style={styles.noteInput}
            selectionColor={C.accent}
          />
        </View>

        {/* Details */}
        <View style={{ paddingHorizontal: 20 }}>
          <Tag style={{ marginBottom: 10 }}>DETAILS</Tag>
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 2,
            }}>
            {(
              [
                ['AMOUNT', formatAmount(tx.amount)],
                ['DATE', format(parseISO(tx.date), 'd MMM yyyy')],
                ['TIME', formatTime(tx.date)],
                ['SOURCE', tx.source === 'sms' ? (tx.bank ?? 'SMS') : 'MANUAL'],
              ] as [string, string][]
            ).map(([k, v], i) => (
              <View
                key={k}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                }}>
                <T
                  mono
                  color={C.text3}
                  style={{ fontSize: 11, letterSpacing: 1 }}>
                  {k}
                </T>
                <T mono color={C.text} style={{ fontSize: 12 }}>
                  {v}
                </T>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {dirty ? (
        <View
          style={[
            styles.saveBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}>
          <Button
            label="CANCEL"
            variant="ghost"
            onPress={onBack}
            style={{ flex: 1 }}
          />
          <Button
            label="SAVE CHANGES"
            onPress={handleSave}
            style={{ flex: 2 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  catBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border2,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
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
  smsBox: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  smsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  manualBox: {
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteInput: {
    width: '100%',
    minHeight: 72,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    color: C.text,
    padding: 12,
    fontSize: 13,
    fontFamily: F.inter,
    textAlignVertical: 'top',
  },
  saveBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.bg,
  },
});
