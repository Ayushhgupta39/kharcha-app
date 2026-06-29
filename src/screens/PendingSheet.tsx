import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { Button } from '../components/Button';
import { C, F } from '../lib/tokens';
import { formatTime } from '../lib/format';
import { BUILTIN_CATEGORIES, getCategory } from '../lib/categories';
import { usePending } from '../store/pending';
import { useCategories } from '../store/categories';
import type { PendingSms } from '../db/pending';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function PendingSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const pending = usePending((s) => s.pending);
  const confirm = usePending((s) => s.confirm);
  const ignore = usePending((s) => s.ignore);
  const editPending = usePending((s) => s.editPending);
  const customs = useCategories((s) => s.customs);
  const cats = useCategories((s) => s.all);

  const [idx, setIdx] = useState(0);
  const [pickCat, setPickCat] = useState(false);

  const current = pending[idx] ?? pending[0];
  const total = pending.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={{ height: 80 + insets.top }} onPress={onClose} />
        <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <T mono weight="600" style={{ fontSize: 11, letterSpacing: 1.4 }}>
              {current ? `PENDING · ${idx + 1} OF ${total}` : 'PENDING SMS'}
            </T>
            <Pressable onPress={onClose}>
              <Icon name="x" size={18} color={C.text2} />
            </Pressable>
          </View>

          {!current ? (
            <EmptyState />
          ) : (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  padding: 20,
                  paddingBottom: 80,
                }}
                showsVerticalScrollIndicator={false}>
                {/* Raw SMS */}
                <View style={styles.smsBox}>
                  <View style={styles.smsHeader}>
                    <Icon name="sms" size={14} color={C.text3} />
                    <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 1.2 }}>
                      INBOUND {current.bank ? '· ' + current.bank : ''}
                    </T>
                    <View style={{ flex: 1 }} />
                    <T mono color={C.text4} style={{ fontSize: 10 }}>
                      {formatTime(current.date)}
                    </T>
                  </View>
                  <View style={{ padding: 14 }}>
                    <HighlightedSms text={current.raw_sms} merchant={current.merchant} />
                  </View>
                </View>

                {/* Parsed rule */}
                <View style={styles.parsedRow}>
                  <Tag>PARSED</Tag>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                  <T mono color={C.accent} style={{ fontSize: 10, letterSpacing: 1.2 }}>
                    ● READY
                  </T>
                </View>

                {/* Parsed card */}
                <View style={styles.parsedCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <T mono color={C.text3} style={{ fontSize: 24, marginRight: 2 }}>
                      ₹
                    </T>
                    <T
                      mono
                      style={{
                        fontSize: 40,
                        lineHeight: 40,
                        letterSpacing: -1,
                        color: C.text,
                      }}>
                      {Math.round(current.amount / 100).toLocaleString('en-IN')}
                    </T>
                  </View>
                  <T style={{ fontSize: 14, color: C.text, marginTop: 8 }}>{current.merchant}</T>

                  <View style={styles.divider} />

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                    <Tag>CATEGORY</Tag>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => setPickCat((v) => !v)} style={styles.catBtn}>
                      <CategoryGlyph category={current.category} size={18} customs={customs} />
                      <T mono style={{ fontSize: 11 }}>
                        {getCategory(current.category, customs).label.split(' ')[0].toUpperCase()}
                      </T>
                      <Icon name={pickCat ? 'chevron-d' : 'chevron-r'} size={10} color={C.text3} />
                    </Pressable>
                  </View>

                  {pickCat ? (
                    <View style={styles.catGrid}>
                      {cats.map((c) => {
                        const active = current.category === c.key;
                        return (
                          <Pressable
                            key={c.key}
                            onPress={async () => {
                              await editPending(current.id, {
                                category: c.key,
                              });
                              setPickCat(false);
                            }}
                            style={[
                              styles.catCell,
                              {
                                borderColor: active ? C.accent : C.border2,
                                backgroundColor: active ? C.accentGlow : C.surface,
                              },
                            ]}>
                            <CategoryGlyph
                              category={c.key}
                              size={20}
                              active={active}
                              customs={customs}
                            />
                            <T style={{ fontSize: 11 }}>{c.label.split(' ')[0]}</T>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </ScrollView>

              <View style={styles.actionBar}>
                <Button
                  label="IGNORE"
                  variant="ghost"
                  onPress={async () => {
                    await ignore(current.id);
                    setIdx(0);
                    setPickCat(false);
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  label="CONFIRM & SAVE"
                  onPress={async () => {
                    await confirm(current.id);
                    setIdx(0);
                    setPickCat(false);
                  }}
                  style={{ flex: 2 }}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}>
      <View style={styles.emptyCheck}>
        <Icon name="check" size={26} color={C.accent} />
      </View>
      <T style={{ fontSize: 18, color: C.text, marginTop: 16 }}>Inbox clear</T>
      <T mono color={C.text3} style={{ fontSize: 11, letterSpacing: 1.2, marginTop: 6 }}>
        ALL MESSAGES PROCESSED
      </T>
    </View>
  );
}

function HighlightedSms({ text, merchant }: { text: string; merchant: string }) {
  const parts = useMemo(() => {
    const out: { k: string; hi: boolean; i: number }[] = [];
    const amountRe = /(?:Rs\.?|INR|₹)\s*[\d,]+(?:\.\d{1,2})?/gi;
    const merchRe = merchant ? new RegExp(escape(merchant), 'gi') : null;
    const tokens: { start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = amountRe.exec(text))) {
      tokens.push({ start: m.index, end: m.index + m[0].length });
    }
    if (merchRe) {
      while ((m = merchRe.exec(text))) {
        tokens.push({ start: m.index, end: m.index + m[0].length });
      }
    }
    tokens.sort((a, b) => a.start - b.start);
    let cursor = 0;
    let key = 0;
    for (const t of tokens) {
      if (t.start < cursor) continue;
      if (t.start > cursor) out.push({ k: text.slice(cursor, t.start), hi: false, i: key++ });
      out.push({ k: text.slice(t.start, t.end), hi: true, i: key++ });
      cursor = t.end;
    }
    if (cursor < text.length) out.push({ k: text.slice(cursor), hi: false, i: key++ });
    return out;
  }, [text, merchant]);

  return (
    <T mono color={C.text2} style={{ fontSize: 12, lineHeight: 18 }}>
      {parts.map((p) =>
        p.hi ? (
          <T
            key={p.i}
            mono
            color={C.accent}
            style={{
              fontSize: 12,
              lineHeight: 18,
              backgroundColor: C.accentHighlight,
            }}>
            {p.k}
          </T>
        ) : (
          <T key={p.i} mono color={C.text2} style={{ fontSize: 12, lineHeight: 18 }}>
            {p.k}
          </T>
        )
      )}
    </T>
  );
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Used indirectly above: keep tree-shake happy
void BUILTIN_CATEGORIES;
void F;

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
  smsBox: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
    marginBottom: 24,
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
  parsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  parsedCard: {
    borderWidth: 1,
    borderColor: C.accent,
    backgroundColor: C.accentGlowFaint,
    borderRadius: 2,
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: C.border2,
    marginVertical: 14,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
  },
  catCell: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 2,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  emptyCheck: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.accent,
    backgroundColor: C.accentGlowFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
