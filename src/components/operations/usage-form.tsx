import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OptionSelect } from '@/components/operations/option-select';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { DeploymentUnit, ResourceUsage, ResourceUsageInput } from '@/models/v4/operations';
import { UsagePhase } from '@/models/v4/operations';

interface UsageFormProps {
  dateKey: string;
  units: DeploymentUnit[];
  defaultUnitId: string | null;
  readings: ResourceUsage[];
  busy: boolean;
  onAdd: (input: Omit<ResourceUsageInput, 'DeploymentId' | 'CallId'>) => Promise<boolean>;
}

const numberOrNull = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
};

// A resource usage reading (Phase E, FieldCosting): odometer / meter / fuel for one unit on one day and
// phase. Conflicting readings are flagged NeedsReview server-side; nothing here prices anything.
export const UsageForm = ({ dateKey, units, defaultUnitId, readings, busy, onAdd }: UsageFormProps) => {
  const { t } = useTranslation();
  const [unitId, setUnitId] = useState(defaultUnitId ?? (units[0] ? String(units[0].UnitId) : ''));
  const [phase, setPhase] = useState(String(UsagePhase.Incident));
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('mi');
  const [engineHours, setEngineHours] = useState('');
  const [fuelQuantity, setFuelQuantity] = useState('');
  const [fuelUnit, setFuelUnit] = useState('gal');
  const [saved, setSaved] = useState(false);
  const unitOptions = units.map((unit) => ({ value: String(unit.UnitId), label: unit.CallSign ? `${unit.UnitName} (${unit.CallSign})` : unit.UnitName }));
  const phaseOptions = [UsagePhase.Mobilization, UsagePhase.Standby, UsagePhase.Incident, UsagePhase.Return].map((value) => ({ value: String(value), label: t(`operations.phase.${value}`) }));
  const start = numberOrNull(startOdometer);
  const end = numberOrNull(endOdometer);
  const complete = !!unitId && (start != null || end != null || numberOrNull(engineHours) != null || numberOrNull(fuelQuantity) != null) && (start == null || end == null || end >= start);

  const submit = async () => {
    setSaved(false);
    const ok = await onAdd({
      UnitId: Number(unitId),
      UsageDate: `${dateKey}T00:00:00`,
      Phase: Number(phase),
      StartOdometer: start,
      EndOdometer: end,
      DistanceUnit: distanceUnit,
      Distance: start != null && end != null ? end - start : null,
      EngineHours: numberOrNull(engineHours),
      FuelQuantity: numberOrNull(fuelQuantity),
      FuelUnit: numberOrNull(fuelQuantity) != null ? fuelUnit : null,
    });
    if (ok) {
      setStartOdometer('');
      setEndOdometer('');
      setEngineHours('');
      setFuelQuantity('');
      setSaved(true);
    }
  };

  return (
    <VStack space="md">
      <OptionSelect value={unitId} options={unitOptions} placeholder={t('operations.usage.unit')} onChange={setUnitId} testID="operations-usage-unit" />
      <OptionSelect value={phase} options={phaseOptions} placeholder={t('operations.usage.phase')} onChange={setPhase} testID="operations-usage-phase" />
      <HStack space="sm" className="items-center">
        <Input className="flex-1">
          <InputField value={startOdometer} placeholder={t('operations.usage.startOdometer')} keyboardType="decimal-pad" onChangeText={setStartOdometer} testID="operations-usage-start" />
        </Input>
        <Input className="flex-1">
          <InputField value={endOdometer} placeholder={t('operations.usage.endOdometer')} keyboardType="decimal-pad" onChangeText={setEndOdometer} testID="operations-usage-end" />
        </Input>
        <Button variant="outline" size="sm" onPress={() => setDistanceUnit(distanceUnit === 'mi' ? 'km' : 'mi')} testID="operations-usage-distance-unit">
          <ButtonText>{distanceUnit}</ButtonText>
        </Button>
      </HStack>
      <HStack space="sm" className="items-center">
        <Input className="flex-1">
          <InputField value={engineHours} placeholder={t('operations.usage.engineHours')} keyboardType="decimal-pad" onChangeText={setEngineHours} testID="operations-usage-engine" />
        </Input>
        <Input className="flex-1">
          <InputField value={fuelQuantity} placeholder={t('operations.usage.fuel')} keyboardType="decimal-pad" onChangeText={setFuelQuantity} testID="operations-usage-fuel" />
        </Input>
        <Button variant="outline" size="sm" onPress={() => setFuelUnit(fuelUnit === 'gal' ? 'L' : 'gal')} testID="operations-usage-fuel-unit">
          <ButtonText>{fuelUnit}</ButtonText>
        </Button>
      </HStack>
      <Button onPress={() => void submit()} isDisabled={busy || !complete} testID="operations-usage-add">
        <ButtonText>{t('operations.usage.add')}</ButtonText>
      </Button>
      {saved ? <Text className="text-success-600">{t('operations.usage.saved')}</Text> : null}
      {readings.map((reading) => (
        <HStack key={reading.Id} className="items-center justify-between rounded-lg border border-outline-200 p-3">
          <VStack>
            <Text className="font-semibold">
              {unitOptions.find((option) => option.value === String(reading.UnitId))?.label ?? reading.UnitId} · {t(`operations.phase.${reading.Phase}`)}
            </Text>
            <Text className="text-typography-500">
              {String(reading.UsageDate ?? '').slice(0, 10)}
              {reading.OriginalDistance != null ? ` · ${reading.OriginalDistance} ${reading.DistanceUnit ?? ''}` : ''}
              {reading.EngineHours != null ? ` · ${reading.EngineHours} h` : ''}
              {reading.FuelQuantity != null ? ` · ${reading.FuelQuantity} ${reading.FuelUnit ?? ''}` : ''}
            </Text>
          </VStack>
          {reading.NeedsReview ? <Text className="text-warning-600">{t('operations.usage.needsReview')}</Text> : null}
        </HStack>
      ))}
    </VStack>
  );
};
