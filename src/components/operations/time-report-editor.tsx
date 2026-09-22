import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OptionSelect } from '@/components/operations/option-select';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { EntrySubject } from '@/lib/operations/time';
import { combineDateTime, entryHours, isClockTime, isReportEditable, newEntry, subjectLabel, sumHours, timeOf } from '@/lib/operations/time';
import type { TimeEntry, TimeReport, TimeReportIssue } from '@/models/v4/operations';
import { TimeEntryType } from '@/models/v4/operations';

interface TimeReportEditorProps {
  dateKey: string;
  report: TimeReport | null;
  entries: TimeEntry[];
  subjects: EntrySubject[];
  issues: TimeReportIssue[];
  warnings: TimeReportIssue[];
  canEdit: boolean;
  dirty: boolean;
  busy: boolean;
  onStart: () => void;
  onChange: (entries: TimeEntry[]) => void;
  onSave: () => void;
  onSubmit: () => void;
}

// Keeps the keystrokes local and only commits a complete HH:mm, so a half-typed time never lands
// in the entry as an unparseable value.
const ClockField = ({ value, onCommit, isDisabled, testID }: { value: string; onCommit: (clock: string) => void; isDisabled: boolean; testID: string }) => {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  return (
    <Input isDisabled={isDisabled} className="w-24">
      <InputField
        testID={testID}
        value={text}
        placeholder="HH:mm"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        onChangeText={(next) => {
          setText(next);
          if (isClockTime(next)) onCommit(next);
        }}
      />
    </Input>
  );
};

export const TimeReportEditor = ({ dateKey, report, entries, subjects, issues, warnings, canEdit, dirty, busy, onStart, onChange, onSave, onSubmit }: TimeReportEditorProps) => {
  const { t } = useTranslation();
  const editable = canEdit && isReportEditable(report);
  const typeOptions = [
    { value: String(TimeEntryType.Deployment), label: t('operations.entryType.0') },
    { value: String(TimeEntryType.Standby), label: t('operations.entryType.1') },
    { value: String(TimeEntryType.Travel), label: t('operations.entryType.2') },
  ];
  const subjectOptions = subjects.map((subject) => ({ value: `${subject.type}:${subject.id}`, label: subject.label }));
  const update = (index: number, patch: Partial<TimeEntry>) => onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const remove = (index: number) => onChange(entries.filter((_, i) => i !== index).map((entry, i) => ({ ...entry, SortOrder: i })));
  const add = () => {
    const subject = subjects[0];
    if (subject) onChange([...entries, newEntry(subject, dateKey, entries.length)]);
  };
  const setSubject = (index: number, value: string) => {
    const subject = subjects.find((candidate) => `${candidate.type}:${candidate.id}` === value);
    if (!subject) return;
    const blank = newEntry(subject, dateKey, index);
    update(index, { SubjectType: blank.SubjectType, DeploymentPersonnelId: blank.DeploymentPersonnelId, DeploymentUnitId: blank.DeploymentUnitId, DeploymentEquipmentId: blank.DeploymentEquipmentId });
  };
  const issueFor = (index: number) => issues.filter((issue) => issue.EntryId === String(index) || (!!entries[index]?.Id && issue.EntryId === entries[index]?.Id));

  if (!report) {
    return (
      <VStack space="sm">
        <Text className="text-typography-500">{t('operations.time.noReport')}</Text>
        {canEdit ? (
          <Button onPress={onStart} isDisabled={busy} testID="operations-start-report">
            <ButtonText>{t('operations.time.start')}</ButtonText>
          </Button>
        ) : null}
      </VStack>
    );
  }

  return (
    <VStack space="md">
      <HStack className="items-center justify-between">
        <Text className="font-semibold">{t('operations.time.report', { number: report.ReportNumber })}</Text>
        <Text className="text-typography-500">{t(`operations.reportStatus.${report.Status}`)}</Text>
      </HStack>
      {entries.length === 0 ? <Text className="text-typography-500">{t('operations.time.noEntries')}</Text> : null}
      {entries.map((entry, index) => (
        <VStack key={entry.Id ?? `new-${index}`} space="xs" className="rounded-lg border border-outline-200 p-3">
          <OptionSelect
            value={`${entry.SubjectType}:${entry.DeploymentPersonnelId ?? entry.DeploymentUnitId ?? entry.DeploymentEquipmentId ?? ''}`}
            options={subjectOptions}
            placeholder={subjectLabel(entry, subjects) || t('operations.time.subject')}
            onChange={(value) => setSubject(index, value)}
            isDisabled={!editable}
            testID={`operations-entry-subject-${index}`}
          />
          <OptionSelect
            value={String(entry.EntryType)}
            options={typeOptions}
            placeholder={t('operations.time.type')}
            onChange={(value) => update(index, { EntryType: Number(value) })}
            isDisabled={!editable}
            testID={`operations-entry-type-${index}`}
          />
          <HStack space="sm" className="items-center">
            <Text className="w-12">{t('operations.time.from')}</Text>
            <ClockField value={timeOf(entry.StartTime)} onCommit={(clock) => update(index, { StartTime: combineDateTime(dateKey, clock) })} isDisabled={!editable} testID={`operations-entry-start-${index}`} />
            <Text className="w-8">{t('operations.time.to')}</Text>
            <ClockField value={timeOf(entry.EndTime)} onCommit={(clock) => update(index, { EndTime: combineDateTime(dateKey, clock) })} isDisabled={!editable} testID={`operations-entry-end-${index}`} />
          </HStack>
          <HStack space="sm" className="items-center">
            <Text className="flex-1">{t('operations.time.unpaidBreak')}</Text>
            <Input isDisabled={!editable} className="w-20">
              <InputField
                value={String(entry.UnpaidBreakMinutes ?? 0)}
                keyboardType="number-pad"
                onChangeText={(text) => update(index, { UnpaidBreakMinutes: Math.max(0, Number(text) || 0) })}
                testID={`operations-entry-break-${index}`}
              />
            </Input>
          </HStack>
          <HStack space="sm" className="items-center justify-between">
            <Text>{t('operations.time.meals')}</Text>
            <Switch value={entry.AgencySuppliedMeals} onValueChange={(value) => update(index, { AgencySuppliedMeals: value })} isDisabled={!editable} />
          </HStack>
          <HStack space="sm" className="items-center justify-between">
            <Text>{t('operations.time.accommodation')}</Text>
            <Switch value={entry.AgencySuppliedAccommodation} onValueChange={(value) => update(index, { AgencySuppliedAccommodation: value })} isDisabled={!editable} />
          </HStack>
          <Input isDisabled={!editable}>
            <InputField value={entry.Notes ?? ''} placeholder={t('operations.time.notes')} onChangeText={(text) => update(index, { Notes: text || null })} testID={`operations-entry-notes-${index}`} />
          </Input>
          <HStack className="items-center justify-between">
            <Text className="text-typography-500">{t('operations.time.hours', { hours: entryHours(entry) })}</Text>
            {editable ? (
              <Button variant="link" action="negative" size="sm" onPress={() => remove(index)} testID={`operations-entry-remove-${index}`}>
                <ButtonText>{t('operations.time.remove')}</ButtonText>
              </Button>
            ) : null}
          </HStack>
          {issueFor(index).map((issue, i) => (
            <Text key={`${issue.Code}-${i}`} accessibilityRole="alert" className="text-error-600">
              {t(`operations.issues.${issue.Code}`, { defaultValue: issue.Detail ?? issue.Code })}
            </Text>
          ))}
        </VStack>
      ))}
      {issues
        .filter((issue) => !issue.EntryId || !entries.some((entry, index) => issue.EntryId === String(index) || issue.EntryId === entry.Id))
        .map((issue, i) => (
          <Text key={`${issue.Code}-${i}`} accessibilityRole="alert" className="text-error-600">
            {t(`operations.issues.${issue.Code}`, { defaultValue: issue.Detail ?? issue.Code })}
          </Text>
        ))}
      {warnings.map((warning, i) => (
        <Text key={`${warning.Code}-${i}`} className="text-warning-600">
          {t(`operations.issues.${warning.Code}`, { defaultValue: warning.Detail ?? warning.Code })}
        </Text>
      ))}
      <Text className="font-semibold">{t('operations.time.total', { hours: sumHours(entries) })}</Text>
      {editable ? (
        <VStack space="sm">
          <Button variant="outline" onPress={add} isDisabled={busy || subjects.length === 0} testID="operations-add-entry">
            <ButtonText>{t('operations.time.addEntry')}</ButtonText>
          </Button>
          <Button onPress={onSave} isDisabled={busy || !dirty} testID="operations-save-entries">
            <ButtonText>{t('operations.time.save')}</ButtonText>
          </Button>
          <Button action="positive" onPress={onSubmit} isDisabled={busy || dirty || entries.length === 0} testID="operations-submit-report">
            <ButtonText>{t('operations.time.submit')}</ButtonText>
          </Button>
        </VStack>
      ) : null}
    </VStack>
  );
};
