import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Icon, type IconName } from './Icon';
import { C, F } from '../lib/tokens';

export type Tab = 'home' | 'txns' | 'stats' | 'settings';

type Item = { id: Tab | 'add'; icon: IconName; label: string; primary?: boolean };

const ITEMS: Item[] = [
  { id: 'home', icon: 'home', label: 'HOME' },
  { id: 'txns', icon: 'list', label: 'LEDGER' },
  { id: 'add', icon: 'plus', label: '', primary: true },
  { id: 'stats', icon: 'chart', label: 'INSIGHTS' },
  { id: 'settings', icon: 'settings', label: 'MORE' },
];

type Props = {
  active: Tab;
  onTab: (t: Tab) => void;
  onAdd: () => void;
};

export function BottomNav({ active, onTab, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 20) },
      ]}>
      {ITEMS.map((it) => {
        if (it.primary) {
          return (
            <Pressable
              key={it.id}
              onPress={onAdd}
              style={styles.flex1}
              android_ripple={null}>
              <View style={styles.primary}>
                <Icon name="plus" size={22} color="#0A0A0A" strokeWidth={2.2} />
              </View>
            </Pressable>
          );
        }
        const isActive = active === it.id;
        return (
          <Pressable
            key={it.id}
            onPress={() => onTab(it.id as Tab)}
            style={styles.tabBtn}
            android_ripple={null}>
            {isActive && <View style={styles.activeBar} />}
            <Icon
              name={it.icon}
              size={20}
              color={isActive ? C.text : C.text3}
              strokeWidth={1.8}
            />
            <T
              mono
              weight="500"
              color={isActive ? C.text : C.text3}
              style={{
                fontSize: 9,
                letterSpacing: 1.2,
                marginTop: 5,
              }}>
              {it.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  flex1: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  primary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 2,
    backgroundColor: C.accent,
  },
});

export { F };
