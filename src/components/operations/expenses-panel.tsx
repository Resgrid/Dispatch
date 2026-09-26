import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { OptionSelect } from '@/components/operations/option-select';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type CapturedPhoto, capturePhoto, discardPhoto, PhotoPermissionError } from '@/lib/media/photo';
import { dateOf } from '@/lib/operations/time';
import type { Expense, ExpenseInput } from '@/models/v4/operations';
import { ExpenseType } from '@/models/v4/operations';

interface ExpensesPanelProps {
  dateKey: string;
  currency?: string | null;
  expenses: Expense[];
  /** The open report the expense belongs to, when the person may act on it. */
  reportId: string | null;
  userId: string | null;
  canManage: boolean;
  canAdd: boolean;
  busy: boolean;
  onAdd: (input: Omit<ExpenseInput, 'DeploymentId'>) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

const amountOf = (text: string) => {
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
};

// Field expenses against the deployment (fuel, meals, lodging, restock) with a receipt photo. The receipt is
// re-encoded (no GPS or device metadata) and filed by the server as a Receipt attachment; a member removes
// only the expenses they added.
export const ExpensesPanel = ({ dateKey, currency, expenses, reportId, userId, canManage, canAdd, busy, onAdd, onRemove }: ExpensesPanelProps) => {
  const { t } = useTranslation();
  const [type, setType] = useState(String(ExpenseType.Fuel));
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [receipt, setReceipt] = useState<CapturedPhoto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const typeOptions = Object.values(ExpenseType).map((value) => ({ value: String(value), label: t(`operations.expenses.type.${value}`) }));
  const day = expenses.filter((expense) => dateOf(expense.ExpenseDate) === dateKey);
  const others = expenses.filter((expense) => dateOf(expense.ExpenseDate) !== dateKey);

  const pick = async (source: 'camera' | 'library') => {
    setMessage(null);
    try {
      const photo = await capturePhoto(source, `receipt-${dateKey}.jpg`);
      if (photo) {
        await discardPhoto(receipt);
        setReceipt(photo);
      }
    } catch (error) {
      setMessage(error instanceof PhotoPermissionError ? t('operations.expenses.photoDenied') : t('operations.errors.retry'));
    }
  };

  const add = async () => {
    const value = amountOf(amount);
    if (value == null) {
      setMessage(t('operations.expenses.amountInvalid'));
      return;
    }
    const ok = await onAdd({
      ExpenseDate: dateKey,
      ExpenseType: Number(type),
      Amount: value,
      Currency: currency ?? null,
      Description: description.trim() || null,
      City: city.trim() || null,
      TimeReportId: reportId,
      ReceiptData: receipt?.base64 ?? null,
      ReceiptFileName: receipt?.name ?? null,
      ReceiptContentType: receipt?.contentType ?? null,
    });
    if (ok) {
      await discardPhoto(receipt);
      setReceipt(null);
      setAmount('');
      setDescription('');
      setCity('');
      setMessage(t('operations.expenses.saved'));
    }
  };

  const confirmRemove = (expense: Expense) =>
    Alert.alert(t('operations.expenses.removeTitle'), t('operations.expenses.removeBody'), [
      { text: t('operations.expenses.cancel'), style: 'cancel' },
      { text: t('operations.expenses.remove'), style: 'destructive', onPress: () => void onRemove(expense.Id) },
    ]);

  const row = (expense: Expense) => (
    <HStack key={expense.Id} className="items-center justify-between rounded-lg border border-outline-200 p-2" testID={`operations-expense-${expense.Id}`}>
      <VStack className="flex-1">
        <Text className="font-semibold">
          {t(`operations.expenses.type.${expense.ExpenseType}`)} · {expense.Amount.toFixed(2)} {expense.Currency ?? ''}
        </Text>
        <Text className="text-typography-500">
          {[dateOf(expense.ExpenseDate), expense.Description, expense.City, expense.ReceiptAttachmentId ? t('operations.expenses.hasReceipt') : null].filter(Boolean).join(' · ')}
        </Text>
      </VStack>
      {canManage || (!!userId && expense.AddedByUserId === userId) ? (
        <Button variant="link" action="negative" size="sm" onPress={() => confirmRemove(expense)} isDisabled={busy} testID={`operations-expense-remove-${expense.Id}`}>
          <ButtonText>{t('operations.expenses.remove')}</ButtonText>
        </Button>
      ) : null}
    </HStack>
  );

  return (
    <VStack space="md">
      {day.length === 0 ? <Text className="text-typography-500">{t('operations.expenses.noneToday')}</Text> : day.map(row)}
      {canAdd ? (
        <VStack space="sm" className="rounded-lg border border-outline-200 p-3" testID="operations-expense-form">
          <Text className="font-semibold">{t('operations.expenses.add')}</Text>
          <OptionSelect value={type} options={typeOptions} placeholder={t('operations.expenses.typeLabel')} onChange={setType} testID="operations-expense-type" />
          <Input>
            <InputField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={t('operations.expenses.amount', { currency: currency ?? '' })} testID="operations-expense-amount" />
          </Input>
          <Input>
            <InputField value={description} onChangeText={setDescription} placeholder={t('operations.expenses.description')} maxLength={500} testID="operations-expense-description" />
          </Input>
          <Input>
            <InputField value={city} onChangeText={setCity} placeholder={t('operations.expenses.city')} maxLength={200} testID="operations-expense-city" />
          </Input>
          <HStack space="sm">
            <Button variant="outline" size="sm" onPress={() => void pick('camera')} testID="operations-expense-camera">
              <ButtonText>{t('operations.expenses.takePhoto')}</ButtonText>
            </Button>
            <Button variant="outline" size="sm" onPress={() => void pick('library')} testID="operations-expense-library">
              <ButtonText>{t('operations.expenses.choosePhoto')}</ButtonText>
            </Button>
          </HStack>
          {receipt ? <Text className="text-typography-500">{t('operations.expenses.receiptAttached')}</Text> : null}
          <Button onPress={() => void add()} isDisabled={busy || !amount.trim()} testID="operations-expense-save">
            <ButtonText>{t('operations.expenses.save')}</ButtonText>
          </Button>
        </VStack>
      ) : null}
      {message ? <Text className="text-typography-500">{message}</Text> : null}
      {others.length > 0 ? (
        <VStack space="xs">
          <Text className="font-semibold">{t('operations.expenses.otherDays')}</Text>
          {others.map(row)}
        </VStack>
      ) : null}
    </VStack>
  );
};
