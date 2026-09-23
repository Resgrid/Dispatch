import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OptionSelect } from '@/components/operations/option-select';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { EntrySubject } from '@/lib/operations/time';
import { applyToCrew, combineDateTime, dateOf, endLocalFor, entryHours, hoursBySubject, isClockTime, isReportEditable, newEntry, subjectIdOf, sumHours, timeOf } from '@/lib/operations/time';
import type { TimeEntry, TimeReport, TimeReportIssue } from '@/models/v4/operations';
import { TimeEntryType, TimeReportScope, TimeReportStatus, TimeSubjectType } from '@/models/v4/operations';

interface TimeReportEditorProps {
  dateKey: string;
  report: TimeReport | null;
  entries: TimeEntry[];
  /** Subjects the person may add rows for in this report's scope. */
  subjects: EntrySubject[];
  /** Roster names by subject id, including released members, for stored rows. */
  names: Record<string, string>;
  /** Short name of the crew or person the report covers ("Engine 41", "A. Smith"); empty for a deployment DTR. */
  scopeLabel: string;
  isCrew: boolean;
  /** Set when this person's or crew's time for the day already sits on another report. */
  coveredBy: TimeReport | null;
  issues: TimeReportIssue[];
  warnings: TimeReportIssue[];
  canCreate: boolean;
  canApprove: boolean;
  canWrite: (subjectId: string) => boolean;
  dirty: boolean;
  busy: boolean;
  onStart: () => void;
  onChange: (entries: TimeEntry[]) => void;
  onSave: () => void;
  onSubmit: () => void;
  onSign: (crewBossSigned: boolean, customerSignerName?: string | null) => void;
  onApprove: () => void;
}

// Keeps the keystrokes local and only commits a complete HH:mm, so a half-typed time never lands
// in the entry as an unparseable value.
const ClockField = ({ value, onCommit, isDisabled, testID, label }: { value: string; onCommit: (clock: string) => void; isDisabled: boolean; testID: string; label: string }) => {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  return (
    <Input isDisabled={isDisabled} className="w-24">
      <InputField
        testID={testID}
        accessibilityLabel={label}
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

const typeRank = (entry: TimeEntry) => (entry.SubjectType === TimeSubjectType.Unit ? 0 : entry.SubjectType === TimeSubjectType.Personnel ? 1 : 2);

// A crew or individual time report for one day (the paper CTR / OF-288 analog). On a crew report the unit's
// row leads; "Apply to crew" copies its shift to every crew member and piece of equipment on the same entry
// type, which is how most crews fill the form, and rows that differ are edited one by one. The crew boss
// signs, the agency signer's name can be recorded, and the report is submitted for approval.
export const TimeReportEditor = ({
  dateKey,
  report,
  entries,
  subjects,
  names,
  scopeLabel,
  isCrew,
  coveredBy,
  issues,
  warnings,
  canCreate,
  canApprove,
  canWrite,
  dirty,
  busy,
  onStart,
  onChange,
  onSave,
  onSubmit,
  onSign,
  onApprove,
}: TimeReportEditorProps) => {
  const { t } = useTranslation();
  const [customerSigner, setCustomerSigner] = useState('');
  const editable = isReportEditable(report);
  const typeOptions = [
    { value: String(TimeEntryType.Deployment), label: t('operations.entryType.0') },
    { value: String(TimeEntryType.Standby), label: t('operations.entryType.1') },
    { value: String(TimeEntryType.Travel), label: t('operations.entryType.2') },
  ];
  const subjectOptions = subjects.map((subject) => ({ value: `${subject.type}:${subject.id}`, label: subject.label }));
  // Unit first, then crew, then equipment; indexes still point into the saved order.
  const order = useMemo(() => entries.map((entry, index) => ({ entry, index })).sort((a, b) => typeRank(a.entry) - typeRank(b.entry) || a.index - b.index), [entries]);
  const perSubject = useMemo(() => hoursBySubject(entries), [entries]);
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
  const setStart = (index: number, clock: string) => {
    const entry = entries[index];
    const startLocal = combineDateTime(dateOf(entry.StartLocal) || dateKey, clock);
    update(index, { StartLocal: startLocal, EndLocal: endLocalFor(startLocal, timeOf(entry.EndLocal) || clock) });
  };
  const issueFor = (index: number) => issues.filter((issue) => issue.EntryId === String(index) || (!!entries[index]?.Id && issue.EntryId === entries[index]?.Id));
  const issueText = (issue: TimeReportIssue) => t(`operations.issues.${issue.Code}`, { defaultValue: issue.Detail ?? issue.Code });
  const title = !report
    ? ''
    : report.Scope === TimeReportScope.Crew
      ? t('operations.time.crewReport', { number: report.ReportNumber, name: scopeLabel })
      : report.Scope === TimeReportScope.Individual
        ? t('operations.time.individualReport', { number: report.ReportNumber, name: scopeLabel })
        : t('operations.time.report', { number: report.ReportNumber });

  if (!report) {
    return (
      <VStack space="sm">
        <Text className="text-typography-500">{isCrew ? t('operations.time.noCrewReport', { name: scopeLabel }) : t('operations.time.noReport')}</Text>
        {coveredBy ? <Text className="text-typography-500">{t('operations.time.coveredBy', { number: coveredBy.ReportNumber })}</Text> : null}
        {canCreate && !coveredBy ? (
          <Button onPress={onStart} isDisabled={busy} testID="operations-start-report">
            <ButtonText>{isCrew ? t('operations.time.startCrew') : t('operations.time.start')}</ButtonText>
          </Button>
        ) : null}
      </VStack>
    );
  }

  const signable = report.CanAct && (report.Status === TimeReportStatus.Draft || report.Status === TimeReportStatus.Submitted);

  return (
    <VStack space="md">
      <HStack className="items-center justify-between">
        <Text className="flex-1 font-semibold">{title}</Text>
        <Text className="text-typography-500">{t(`operations.reportStatus.${report.Status}`)}</Text>
      </HStack>
      {!report.CanAct ? <Text className="text-typography-500">{t('operations.time.readOnly')}</Text> : null}
      {entries.length === 0 ? <Text className="text-typography-500">{t('operations.time.noEntries')}</Text> : null}
      {order.map(({ entry, index }) => {
        const subjectId = subjectIdOf(entry);
        const rowEditable = editable && canWrite(subjectId);
        const label = names[subjectId] ?? '';
        return (
          <VStack key={entry.Id ?? `new-${index}`} space="xs" className="rounded-lg border border-outline-200 p-3" testID={`operations-entry-${index}`}>
            {entry.Id || !rowEditable ? (
              <Text className="font-semibold">{label || t('operations.time.subject')}</Text>
            ) : (
              <OptionSelect
                value={`${entry.SubjectType}:${subjectId}`}
                options={subjectOptions}
                placeholder={label || t('operations.time.subject')}
                onChange={(value) => setSubject(index, value)}
                testID={`operations-entry-subject-${index}`}
              />
            )}
            <OptionSelect
              value={String(entry.EntryType)}
              options={typeOptions}
              placeholder={t('operations.time.type')}
              onChange={(value) => update(index, { EntryType: Number(value) })}
              isDisabled={!rowEditable}
              testID={`operations-entry-type-${index}`}
            />
            <HStack space="sm" className="items-center">
              <Text className="w-12">{t('operations.time.from')}</Text>
              <ClockField label={t('operations.time.from')} value={timeOf(entry.StartLocal)} onCommit={(clock) => setStart(index, clock)} isDisabled={!rowEditable} testID={`operations-entry-start-${index}`} />
              <Text className="w-8">{t('operations.time.to')}</Text>
              <ClockField
                label={t('operations.time.to')}
                value={timeOf(entry.EndLocal)}
                onCommit={(clock) => update(index, { EndLocal: endLocalFor(entry.StartLocal, clock) })}
                isDisabled={!rowEditable}
                testID={`operations-entry-end-${index}`}
              />
            </HStack>
            {dateOf(entry.EndLocal) > dateOf(entry.StartLocal) ? <Text className="text-typography-500">{t('operations.time.nextDay')}</Text> : null}
            <HStack space="sm" className="items-center">
              <Text className="flex-1">{t('operations.time.unpaidBreak')}</Text>
              <Input isDisabled={!rowEditable} className="w-20">
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
              <Switch value={entry.AgencySuppliedMeals} onValueChange={(value) => update(index, { AgencySuppliedMeals: value })} isDisabled={!rowEditable} />
            </HStack>
            <HStack space="sm" className="items-center justify-between">
              <Text>{t('operations.time.accommodation')}</Text>
              <Switch value={entry.AgencySuppliedAccommodation} onValueChange={(value) => update(index, { AgencySuppliedAccommodation: value })} isDisabled={!rowEditable} />
            </HStack>
            <Input isDisabled={!rowEditable}>
              <InputField value={entry.Notes ?? ''} placeholder={t('operations.time.notes')} onChangeText={(text) => update(index, { Notes: text || null })} testID={`operations-entry-notes-${index}`} />
            </Input>
            <HStack className="items-center justify-between">
              <Text className="text-typography-500">{t('operations.time.hours', { hours: entryHours(entry) })}</Text>
              {rowEditable ? (
                <HStack space="sm">
                  {isCrew && entries.length > 1 ? (
                    <Button variant="link" size="sm" onPress={() => onChange(applyToCrew(entries, index, canWrite))} testID={`operations-entry-apply-${index}`}>
                      <ButtonText>{t('operations.time.applyToCrew')}</ButtonText>
                    </Button>
                  ) : null}
                  <Button variant="link" action="negative" size="sm" onPress={() => remove(index)} testID={`operations-entry-remove-${index}`}>
                    <ButtonText>{t('operations.time.remove')}</ButtonText>
                  </Button>
                </HStack>
              ) : null}
            </HStack>
            {issueFor(index).map((issue, i) => (
              <Text key={`${issue.Code}-${i}`} accessibilityRole="alert" className="text-error-600">
                {issueText(issue)}
              </Text>
            ))}
          </VStack>
        );
      })}
      {issues
        .filter((issue) => !issue.EntryId || !entries.some((entry, index) => issue.EntryId === String(index) || issue.EntryId === entry.Id))
        .map((issue, i) => (
          <Text key={`${issue.Code}-${i}`} accessibilityRole="alert" className="text-error-600">
            {issueText(issue)}
            {issue.SubjectId && names[issue.SubjectId] ? ` — ${names[issue.SubjectId]}` : ''}
          </Text>
        ))}
      {warnings.map((warning, i) => (
        <Text key={`${warning.Code}-${i}`} className="text-warning-600">
          {issueText(warning)}
          {warning.SubjectId && names[warning.SubjectId] ? ` — ${names[warning.SubjectId]}` : ''}
        </Text>
      ))}
      {Object.keys(perSubject).length > 1 ? (
        <VStack space="xs" className="rounded-lg bg-background-50 p-3" testID="operations-hours-summary">
          {Object.entries(perSubject).map(([subjectId, hours]) => (
            <HStack key={subjectId} className="justify-between">
              <Text className="flex-1">{names[subjectId] ?? subjectId}</Text>
              <Text>{t('operations.time.hours', { hours })}</Text>
            </HStack>
          ))}
        </VStack>
      ) : null}
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
      {signable || report.ContractorSignedOn || report.CustomerSignedOn ? (
        <VStack space="sm" className="rounded-lg border border-outline-200 p-3" testID="operations-signatures">
          <Text className="font-semibold">{t('operations.sign.title')}</Text>
          <Text className="text-typography-500">
            {report.ContractorSignedOn ? t('operations.sign.crewBossSigned', { when: String(report.ContractorSignedOn).slice(0, 16).replace('T', ' ') }) : t('operations.sign.crewBossPending')}
          </Text>
          <Text className="text-typography-500">{report.CustomerSignedOn ? t('operations.sign.customerSigned', { name: report.CustomerSignerName ?? '' }) : t('operations.sign.customerPending')}</Text>
          {signable ? (
            <>
              {!report.ContractorSignedOn ? (
                <Button variant="outline" onPress={() => onSign(true)} isDisabled={busy || dirty} testID="operations-sign-crew-boss">
                  <ButtonText>{t('operations.sign.asCrewBoss')}</ButtonText>
                </Button>
              ) : null}
              <Input>
                <InputField value={customerSigner} placeholder={t('operations.sign.customerName')} onChangeText={setCustomerSigner} maxLength={200} testID="operations-sign-customer-name" />
              </Input>
              <Button
                variant="outline"
                onPress={() => {
                  onSign(false, customerSigner.trim());
                  setCustomerSigner('');
                }}
                isDisabled={busy || dirty || !customerSigner.trim()}
                testID="operations-sign-customer"
              >
                <ButtonText>{t('operations.sign.recordCustomer')}</ButtonText>
              </Button>
            </>
          ) : null}
        </VStack>
      ) : null}
      {canApprove && report.Status === TimeReportStatus.Submitted ? (
        <Button action="positive" onPress={onApprove} isDisabled={busy} testID="operations-approve-report">
          <ButtonText>{t('operations.time.approve')}</ButtonText>
        </Button>
      ) : null}
    </VStack>
  );
};
