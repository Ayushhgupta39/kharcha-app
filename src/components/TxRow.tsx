import { Pressable, View, StyleSheet } from 'react-native';
import { T, Tag } from './Text';
import { CategoryGlyph } from './CategoryGlyph';
import { C, F } from '../lib/tokens';
import { formatAmount, formatTime } from '../lib/format';
import { getCategory, type Category } from '../lib/categories';
import type { Transaction } from '../db/transactions';
import { useState } from 'react';

type Props = {
  tx: Transaction;
  onPress: () => void;
  customs?: Category[];
};

export function TxRow({ tx, onPress, customs = [] }: Props) {
  const cat = getCategory(tx.category, customs);
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
       style={{
        ...styles.row,
        ...(pressed ? { backgroundColor: C.surface2 } : {}),
      }}>
      <CategoryGlyph category={tx.category} size={38} customs={customs} />
      <View style={styles.middle}>
        <T
          variant="body"
          weight="500"
          numberOfLines={1}
          style={{ fontSize: 14 }}>
          {tx.merchant}
        </T>
        <View style={styles.metaRow}>
          <T mono color={C.text3} style={{ fontSize: 11 }}>
            {formatTime(tx.date)}
          </T>
          <T style={{ fontSize: 10, color: C.text4 }}>·</T>
          <Tag>{cat.label.split(' ')[0]}</Tag>
          {tx.source === 'sms' && tx.bank ? (
            <>
              <T style={{ fontSize: 10, color: C.text4 }}>·</T>
              <Tag color={C.text3}>{tx.bank}</Tag>
            </>
          ) : null}
          {tx.source === 'manual' ? (
            <>
              <T style={{ fontSize: 10, color: C.text4 }}>·</T>
              <Tag color={C.text3}>MANUAL</Tag>
            </>
          ) : null}
        </View>
      </View>
      <T
        mono
        weight="500"
        style={{
          fontSize: 15,
          color: C.text,
          fontVariant: ['tabular-nums'],
        }}>
        {formatAmount(tx.amount)}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
});

export { F };
