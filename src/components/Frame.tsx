import { View, type ViewProps } from 'react-native';
import { T } from './Text';

type Props = ViewProps & {
  label?: string;
  right?: React.ReactNode;
};

export function Frame({ label, right, children, style, ...rest }: Props) {
  return (
    <View style={[{ flex: 1 }, style]} {...rest}>
      {(label || right) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
          }}>
          {label ? (
            <T variant="label" mono weight="500" color="#6B6B6B" uppercase>
              {label}
            </T>
          ) : (
            <View />
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}
