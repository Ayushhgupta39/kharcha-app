import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Icon } from './Icon';
import { C } from '../lib/tokens';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  topOffset?: number;
};

export function Sheet({
  visible,
  title,
  onClose,
  children,
  topOffset = 80,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={{ height: topOffset + insets.top }} onPress={onClose} />
        <View
          style={[
            styles.panel,
            { paddingBottom: insets.bottom },
          ]}>
          <View style={styles.header}>
            <T
              mono
              weight="600"
              style={{ fontSize: 11, letterSpacing: 1.4 }}>
              {title}
            </T>
            <Pressable onPress={onClose}>
              <Icon name="x" size={18} color={C.text2} />
            </Pressable>
          </View>
          {children}
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
});
