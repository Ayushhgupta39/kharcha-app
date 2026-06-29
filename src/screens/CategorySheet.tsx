import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { C } from '../lib/tokens';
import { formatAmount } from '../lib/format';
import { getCategory } from '../lib/categories';
import { useCategories } from '../store/categories';
import type { Transaction } from '../db/transactions';

type Props = {
  category: string;
  txs: Transaction[];
  onBack: () => void;
  onOpenTx: (id: string) => void;
};

export function CategorySheet({ category, txs, onBack, onOpenTx }: Props) {
  const insets = useSafeAreaInsets();
  const customs = useCategories((s) => s.customs);
  const cat = getCategory(category, customs);

  const total = txs.reduce((s, t) => s + t.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingBottom: 14,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="arrow-l" size={18} color={C.text} />
          <T mono style={{ fontSize: 11, letterSpacing: 1.2 }}>
            BACK
          </T>
        </Pressable>
        <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 1.3 }}>
          {txs.length} TXNS
        </T>
      </View>

      {/* Category hero */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 18,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
        <CategoryGlyph category={category} size={48} active customs={customs} />
        <View style={{ flex: 1 }}>
          <Tag style={{ marginBottom: 4 }}>{cat.label.toUpperCase()}</Tag>
          <T mono style={{ fontSize: 26, letterSpacing: -0.6 }}>
            {formatAmount(total)}
          </T>
        </View>
      </View>

      <FlatList
        data={txs}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TxRow tx={item} onPress={() => onOpenTx(item.id)} customs={customs} />
        )}
        ListEmptyComponent={
          <View style={{ padding: 40 }}>
            <T mono color={C.text3} style={{ fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>
              NO TRANSACTIONS
            </T>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
