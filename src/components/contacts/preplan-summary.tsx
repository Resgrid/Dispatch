import { AlertTriangleIcon, BuildingIcon, CalendarClockIcon, DropletsIcon, FlameIcon, KeyRoundIcon, PhoneIcon, ZapIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ProtectedText } from '@/components/data-protection/protected-text';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type ContactHazardData, type ContactPreplanData } from '@/models/v4/contacts/contactPreplanResult';

/** ADP catalog v12 field ids for the pre-plan text columns (server ProtectedFieldCatalog). */
export const PreplanFieldIds = {
  occupancyNotes: 'contactpreplans.occupancynotes',
  occupancyHours: 'contactpreplans.occupancyhours',
  occupantsNeedingAssistanceNotes: 'contactpreplans.occupantsneedingassistancenotes',
  gasShutoff: 'contactpreplans.gasshutofflocation',
  electricShutoff: 'contactpreplans.electricshutofflocation',
  waterShutoff: 'contactpreplans.watershutofflocation',
  utilityNotes: 'contactpreplans.utilitynotes',
  knoxBox: 'contactpreplans.knoxboxlocation',
  gateCode: 'contactpreplans.gatecode',
  alarmPanel: 'contactpreplans.alarmpanellocation',
  alarmCompany: 'contactpreplans.alarmcompany',
  alarmCompanyPhone: 'contactpreplans.alarmcompanyphone',
  accessNotes: 'contactpreplans.accessnotes',
  nearestHydrant: 'contactpreplans.nearesthydrantlocation',
  waterSupplyNotes: 'contactpreplans.watersupplynotes',
  emergencyContactName: 'contactpreplans.emergencycontactname',
  emergencyContactPhone: 'contactpreplans.emergencycontactphone',
  secondaryContactName: 'contactpreplans.secondarycontactname',
  secondaryContactPhone: 'contactpreplans.secondarycontactphone',
  generalHazardNotes: 'contactpreplans.generalhazardnotes',
  tacticalSummary: 'contactpreplans.tacticalsummary',
  hazardTitle: 'contactpreplanhazards.title',
  hazardDescription: 'contactpreplanhazards.description',
  hazardLocation: 'contactpreplanhazards.locationdescription',
  hazardGps: 'contactpreplanhazards.gpscoordinates',
} as const;

/** Danger red, Caution amber, Info blue — the same palette the web pages use. */
export const hazardSeverityColor = (severity: number): string => {
  if (severity === 2) return '#ef4444';
  if (severity === 1) return '#f59e0b';
  return '#3b82f6';
};

const hasValue = (value?: string | null): boolean => !!value && value.trim().length > 0;

interface FieldProps {
  label: string;
  value?: string | null;
  fieldId: string;
  redactedFields?: string[];
  testID?: string;
}

const Field: React.FC<FieldProps> = ({ label, value, fieldId, redactedFields, testID }) => {
  if (!hasValue(value)) return null;
  return (
    <Box className="mb-2" testID={testID}>
      <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
      <ProtectedText value={value} fieldId={fieldId} redactedFields={redactedFields} className="text-sm text-gray-900 dark:text-white" />
    </Box>
  );
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, children }) => {
  const rendered = React.Children.toArray(children).filter(Boolean);
  if (rendered.length === 0) return null;
  return (
    <Box className="mb-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <HStack space="xs" className="mb-2 items-center">
        {icon}
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">{title}</Text>
      </HStack>
      <VStack>{rendered}</VStack>
    </Box>
  );
};

interface HazardRowProps {
  hazard: ContactHazardData;
}

export const HazardRow: React.FC<HazardRowProps> = ({ hazard }) => {
  const { t } = useTranslation();
  const color = hazardSeverityColor(hazard.Severity);
  return (
    <Box className="mb-2 rounded-md border-l-4 bg-gray-50 p-2 dark:bg-gray-800" style={{ borderLeftColor: color }} testID={`hazard-${hazard.ContactPreplanHazardId}`}>
      <HStack space="xs" className="items-center">
        <AlertTriangleIcon size={14} color={color} />
        <Text className="text-xs font-semibold" style={{ color }}>
          {hazard.SeverityName} · {hazard.HazardTypeName}
        </Text>
        {hazard.ShouldAlert ? <Text className="text-xs text-red-600 dark:text-red-400">{t('contacts.preplan.alert_flag')}</Text> : null}
      </HStack>
      <ProtectedText value={hazard.Title} fieldId={PreplanFieldIds.hazardTitle} redactedFields={hazard.RedactedFields} className="text-sm font-medium text-gray-900 dark:text-white" />
      {hasValue(hazard.Description) ? (
        <ProtectedText value={hazard.Description} fieldId={PreplanFieldIds.hazardDescription} redactedFields={hazard.RedactedFields} className="text-xs text-gray-700 dark:text-gray-300" />
      ) : null}
      {hasValue(hazard.LocationDescription) ? (
        <HStack space="xs" className="items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.preplan.location')}:</Text>
          <ProtectedText value={hazard.LocationDescription} fieldId={PreplanFieldIds.hazardLocation} redactedFields={hazard.RedactedFields} className="text-xs text-gray-700 dark:text-gray-300" />
        </HStack>
      ) : null}
      {hasValue(hazard.GpsCoordinates) ? (
        <ProtectedText value={hazard.GpsCoordinates} fieldId={PreplanFieldIds.hazardGps} redactedFields={hazard.RedactedFields} className="text-xs text-gray-500 dark:text-gray-400" />
      ) : null}
    </Box>
  );
};

interface PreplanSummaryProps {
  preplan: ContactPreplanData | null | undefined;
  /** Hazards to list; defaults to the plan's own. The call Site Info payload carries them beside the plan. */
  hazards?: ContactHazardData[];
  testID?: string;
}

/**
 * Read-only NFPA 1620 pre-plan (Contacts plan Phase A), shared by the contact details sheet and the call
 * Site Info tab. Only populated fields render; every text value goes through ProtectedText so a
 * protected department's REDACTED placeholders show the lock, never the literal word.
 */
export const PreplanSummary: React.FC<PreplanSummaryProps> = ({ preplan, hazards, testID }) => {
  const { t } = useTranslation();
  const hazardList = hazards ?? preplan?.Hazards ?? [];

  if (!preplan && hazardList.length === 0) {
    return (
      <Box className="items-center py-6" testID={testID ?? 'preplan-summary-empty'}>
        <Text className="text-center text-gray-500 dark:text-gray-400">{t('contacts.preplan.none')}</Text>
      </Box>
    );
  }

  const redacted = preplan?.RedactedFields;

  return (
    <VStack testID={testID ?? 'preplan-summary'}>
      {preplan?.IsReviewOverdue ? (
        <HStack space="xs" className="mb-3 items-center rounded-md bg-amber-50 p-2 dark:bg-amber-900/20">
          <CalendarClockIcon size={16} color="#f59e0b" />
          <Text className="text-xs font-medium text-amber-700 dark:text-amber-300">{t('contacts.preplan.review_overdue')}</Text>
        </HStack>
      ) : null}

      {preplan && hasValue(preplan.TacticalSummary) ? (
        <Box className="mb-3 rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
          <Text className="text-xs font-semibold text-blue-700 dark:text-blue-300">{t('contacts.preplan.tactical_summary')}</Text>
          <ProtectedText value={preplan.TacticalSummary} fieldId={PreplanFieldIds.tacticalSummary} redactedFields={redacted} className="text-sm text-blue-900 dark:text-blue-100" />
        </Box>
      ) : null}

      {preplan?.HazmatOnSite ? (
        <HStack space="xs" className="mb-3 items-center rounded-md bg-red-50 p-2 dark:bg-red-900/20">
          <FlameIcon size={16} color="#ef4444" />
          <Text className="text-xs font-semibold text-red-700 dark:text-red-300">{t('contacts.preplan.hazmat_on_site')}</Text>
        </HStack>
      ) : null}

      {hazardList.length > 0 ? (
        <Section title={t('contacts.preplan.hazards')} icon={<AlertTriangleIcon size={16} color="#ef4444" />}>
          {hazardList.map((hazard) => (
            <HazardRow key={hazard.ContactPreplanHazardId} hazard={hazard} />
          ))}
        </Section>
      ) : null}

      {preplan ? (
        <>
          <Section title={t('contacts.preplan.access')} icon={<KeyRoundIcon size={16} color="#6366F1" />}>
            <Field label={t('contacts.preplan.knox_box')} value={preplan.KnoxBoxLocation} fieldId={PreplanFieldIds.knoxBox} redactedFields={redacted} />
            <Field label={t('contacts.preplan.gate_code')} value={preplan.GateCode} fieldId={PreplanFieldIds.gateCode} redactedFields={redacted} testID="preplan-gate-code" />
            <Field label={t('contacts.preplan.alarm_panel')} value={preplan.AlarmPanelLocation} fieldId={PreplanFieldIds.alarmPanel} redactedFields={redacted} />
            <Field label={t('contacts.preplan.alarm_company')} value={preplan.AlarmCompany} fieldId={PreplanFieldIds.alarmCompany} redactedFields={redacted} />
            <Field label={t('contacts.preplan.alarm_company_phone')} value={preplan.AlarmCompanyPhone} fieldId={PreplanFieldIds.alarmCompanyPhone} redactedFields={redacted} />
            <Field label={t('contacts.preplan.access_notes')} value={preplan.AccessNotes} fieldId={PreplanFieldIds.accessNotes} redactedFields={redacted} />
          </Section>

          <Section title={t('contacts.preplan.occupancy')} icon={<BuildingIcon size={16} color="#6366F1" />}>
            <Box className="mb-2">
              <Text className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.preplan.construction')}</Text>
              <Text className="text-sm text-gray-900 dark:text-white">
                {preplan.ConstructionTypeName} · {preplan.RoofTypeName} · {preplan.OccupancyTypeName}
              </Text>
            </Box>
            <Field label={t('contacts.preplan.occupancy_hours')} value={preplan.OccupancyHours} fieldId={PreplanFieldIds.occupancyHours} redactedFields={redacted} />
            {preplan.OccupantLoad != null ? (
              <Box className="mb-2">
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.preplan.occupant_load')}</Text>
                <Text className="text-sm text-gray-900 dark:text-white">{preplan.OccupantLoad}</Text>
              </Box>
            ) : null}
            {preplan.HasOccupantsNeedingAssistance ? (
              <Box className="mb-2 rounded-md bg-red-50 p-2 dark:bg-red-900/20">
                <Text className="text-xs font-semibold text-red-700 dark:text-red-300">{t('contacts.preplan.occupants_needing_assistance')}</Text>
                {hasValue(preplan.OccupantsNeedingAssistanceNotes) ? (
                  <ProtectedText value={preplan.OccupantsNeedingAssistanceNotes} fieldId={PreplanFieldIds.occupantsNeedingAssistanceNotes} redactedFields={redacted} className="text-sm text-red-900 dark:text-red-100" />
                ) : null}
              </Box>
            ) : null}
            <Field label={t('contacts.preplan.occupancy_notes')} value={preplan.OccupancyNotes} fieldId={PreplanFieldIds.occupancyNotes} redactedFields={redacted} />
          </Section>

          <Section title={t('contacts.preplan.utilities')} icon={<ZapIcon size={16} color="#6366F1" />}>
            <Field label={t('contacts.preplan.gas_shutoff')} value={preplan.GasShutoffLocation} fieldId={PreplanFieldIds.gasShutoff} redactedFields={redacted} />
            <Field label={t('contacts.preplan.electric_shutoff')} value={preplan.ElectricShutoffLocation} fieldId={PreplanFieldIds.electricShutoff} redactedFields={redacted} />
            <Field label={t('contacts.preplan.water_shutoff')} value={preplan.WaterShutoffLocation} fieldId={PreplanFieldIds.waterShutoff} redactedFields={redacted} />
            <Field label={t('contacts.preplan.utility_notes')} value={preplan.UtilityNotes} fieldId={PreplanFieldIds.utilityNotes} redactedFields={redacted} />
          </Section>

          <Section title={t('contacts.preplan.water_supply')} icon={<DropletsIcon size={16} color="#6366F1" />}>
            <Field label={t('contacts.preplan.nearest_hydrant')} value={preplan.NearestHydrantLocation} fieldId={PreplanFieldIds.nearestHydrant} redactedFields={redacted} />
            {preplan.RequiredFireFlowGpm != null ? (
              <Box className="mb-2">
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.preplan.required_fire_flow')}</Text>
                <Text className="text-sm text-gray-900 dark:text-white">{preplan.RequiredFireFlowGpm} GPM</Text>
              </Box>
            ) : null}
            <Field label={t('contacts.preplan.water_supply_notes')} value={preplan.WaterSupplyNotes} fieldId={PreplanFieldIds.waterSupplyNotes} redactedFields={redacted} />
          </Section>

          <Section title={t('contacts.preplan.on_site_contacts')} icon={<PhoneIcon size={16} color="#6366F1" />}>
            <Field label={t('contacts.preplan.emergency_contact')} value={preplan.EmergencyContactName} fieldId={PreplanFieldIds.emergencyContactName} redactedFields={redacted} />
            <Field label={t('contacts.preplan.emergency_contact_phone')} value={preplan.EmergencyContactPhone} fieldId={PreplanFieldIds.emergencyContactPhone} redactedFields={redacted} />
            <Field label={t('contacts.preplan.secondary_contact')} value={preplan.SecondaryContactName} fieldId={PreplanFieldIds.secondaryContactName} redactedFields={redacted} />
            <Field label={t('contacts.preplan.secondary_contact_phone')} value={preplan.SecondaryContactPhone} fieldId={PreplanFieldIds.secondaryContactPhone} redactedFields={redacted} />
          </Section>

          <Section title={t('contacts.preplan.general_hazards')} icon={<AlertTriangleIcon size={16} color="#6366F1" />}>
            <Field label={t('contacts.preplan.general_hazard_notes')} value={preplan.GeneralHazardNotes} fieldId={PreplanFieldIds.generalHazardNotes} redactedFields={redacted} />
          </Section>

          <HStack space="xs" className="items-center">
            <CalendarClockIcon size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {preplan.LastReviewedOn ? `${t('contacts.preplan.last_reviewed')}: ${preplan.LastReviewedOn}` : t('contacts.preplan.never_reviewed')}
              {preplan.NextReviewDue ? ` · ${t('contacts.preplan.next_review')}: ${preplan.NextReviewDue}` : ''}
            </Text>
          </HStack>
        </>
      ) : null}
    </VStack>
  );
};
