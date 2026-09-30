import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { parsePickerValue, pickerDate, type PickerMode, pickerTime, serializePickerValue } from '@/lib/date-time-picker';

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  mode?: PickerMode;
  disabled?: boolean;
  clearable?: boolean;
  testID?: string;
}

// One picker for native and web. No keyboard entry; cancel never commits the draft.
// Date-only and clock-only values keep their calendar day/clock across time zones.
export const DateTimeField = ({ value, onChange, label, mode = 'date', disabled = false, clearable = true, testID = 'date-time-field' }: DateTimeFieldProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language ?? 'en';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parsePickerValue(value, mode));
  const [month, setMonth] = useState(draft.getMonth());
  const [year, setYear] = useState(draft.getFullYear());
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [yearPage, setYearPage] = useState(year - 11);
  const selected = parsePickerValue(value, mode);
  const display = !value ? label : mode === 'time' ? pickerTime(selected) : mode === 'date' ? selected.toLocaleDateString(locale) : selected.toLocaleString(locale);
  const show = () => {
    if (disabled) return;
    const next = parsePickerValue(value, mode);
    setDraft(next);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
    setYearPage(Math.max(1, Math.min(9976, next.getFullYear() - 11)));
    setView('days');
    setOpen(true);
  };
  const commit = (next: string) => {
    if (!disabled) onChange(next);
    setOpen(false);
  };
  const calendarDate = (day: number) => {
    const date = new Date(draft);
    date.setDate(1);
    date.setFullYear(year, month, day);
    return date;
  };
  const monthEnd = calendarDate(1);
  monthEnd.setMonth(month + 1, 0);
  const move = (direction: number) => {
    if (view === 'years') {
      setYearPage((page) => Math.max(1, Math.min(9976, page + direction * 24)));
      return;
    }
    const next = calendarDate(1);
    next.setMonth(month + direction);
    if (next.getFullYear() < 1 || next.getFullYear() > 9999) return;
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };
  const choice = (text: string, id: string, onPress: () => void, chosen = false, accessibilityLabel = text) => (
    <Pressable
      key={id}
      testID={`${testID}-${id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: chosen }}
      onPress={onPress}
      className={chosen ? 'min-h-11 items-center justify-center rounded bg-primary-600 px-2 py-3' : 'min-h-11 items-center justify-center rounded px-2 py-3'}
    >
      <Text className={chosen ? 'text-center text-white' : 'text-center text-typography-900'}>{text}</Text>
    </Pressable>
  );
  const clockColumn = (part: 'hour' | 'minute', count: number, current: number) => (
    <View className="flex-1">
      <Text className="text-center font-semibold">{t(`dateTimePicker.${part}`)}</Text>
      <ScrollView nestedScrollEnabled style={{ height: 192 }} contentOffset={{ x: 0, y: current * 48 }}>
        {Array.from({ length: count }, (_, number) =>
          choice(
            String(number).padStart(2, '0'),
            `${part}-${number}`,
            () => {
              const next = new Date(draft);
              if (part === 'hour') next.setHours(number, next.getMinutes(), 0, 0);
              else next.setMinutes(number, 0, 0);
              setDraft(next);
            },
            current === number
          )
        )}
      </ScrollView>
    </View>
  );
  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={show}
        className="min-h-11 justify-center rounded border border-outline-300 bg-background-0 px-3 py-2"
      >
        {value ? <Text className="text-xs text-typography-500">{label}</Text> : null}
        <Text className={disabled ? 'text-typography-500' : 'text-typography-900'}>{display}</Text>
      </Pressable>
      {open && !disabled ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <SafeAreaView className="flex-1 justify-center bg-black/50 p-4">
            <View accessibilityViewIsModal className="max-h-[95%] w-full max-w-lg self-center rounded-xl bg-background-0 p-4">
              <Text accessibilityRole="header" className="mb-2 text-lg font-bold">
                {label}
              </Text>
              <ScrollView>
                {mode !== 'time' ? (
                  <View>
                    <View className="flex-row items-center justify-between">
                      {choice('‹', 'previous', () => move(-1), false, t('common.previous'))}
                      {choice(calendarDate(1).toLocaleDateString(locale, { month: 'long' }), 'month', () => setView(view === 'months' ? 'days' : 'months'))}
                      {choice(String(year), 'year', () => setView(view === 'years' ? 'days' : 'years'))}
                      {choice('›', 'next', () => move(1), false, t('common.next'))}
                    </View>
                    {view === 'years' ? (
                      <View className="flex-row flex-wrap">
                        {Array.from({ length: 24 }, (_, index) => yearPage + index).map((number) => (
                          <View key={number} style={{ width: '25%' }}>
                            {choice(
                              String(number),
                              `year-${number}`,
                              () => {
                                setYear(number);
                                setView('days');
                              },
                              year === number
                            )}
                          </View>
                        ))}
                      </View>
                    ) : view === 'months' ? (
                      <View className="flex-row flex-wrap">
                        {Array.from({ length: 12 }, (_, number) => (
                          <View key={number} style={{ width: '33.333%' }}>
                            {choice(
                              new Date(2024, number, 1).toLocaleDateString(locale, { month: 'short' }),
                              `month-${number}`,
                              () => {
                                setMonth(number);
                                setView('days');
                              },
                              month === number
                            )}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View className="flex-row flex-wrap">
                        {Array.from({ length: 7 }, (_, day) => (
                          <View key={`weekday-${day}`} style={{ width: '14.2857%' }}>
                            <Text className="py-2 text-center text-xs text-typography-500">{new Date(2024, 0, 7 + day).toLocaleDateString(locale, { weekday: 'short' })}</Text>
                          </View>
                        ))}
                        {Array.from({ length: calendarDate(1).getDay() }, (_, index) => (
                          <View key={`blank-${index}`} style={{ width: '14.2857%' }} />
                        ))}
                        {Array.from({ length: monthEnd.getDate() }, (_, index) => index + 1).map((day) => {
                          const date = calendarDate(day);
                          return (
                            <View key={day} style={{ width: '14.2857%' }}>
                              {choice(String(day), `day-${day}`, () => setDraft(date), pickerDate(date) === pickerDate(draft), date.toLocaleDateString(locale, { dateStyle: 'full' }))}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : null}
                {mode !== 'date' ? (
                  <View className="mt-3 flex-row" style={{ gap: 16 }}>
                    {clockColumn('hour', 24, draft.getHours())}
                    {clockColumn('minute', 60, draft.getMinutes())}
                  </View>
                ) : null}
              </ScrollView>
              <View className="mt-3 flex-row justify-between">
                {clearable ? choice(t('dateTimePicker.clear'), 'clear', () => commit('')) : <View />}
                {choice(t('common.cancel'), 'cancel', () => setOpen(false))}
                {choice(t('common.done'), 'done', () => commit(serializePickerValue(draft, mode)), true)}
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
};
