import { View } from 'react-native';
import { Tag } from './Text';
import { C } from '../lib/tokens';

export function LabeledRule({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 10,
      }}>
      <Tag>{label}</Tag>
      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      {right}
    </View>
  );
}
