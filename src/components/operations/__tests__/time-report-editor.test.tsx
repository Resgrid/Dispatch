import { render } from '@testing-library/react-native';
import React from 'react';

import { TimeReportEditor } from '@/components/operations/time-report-editor';
import { type TimeReport, TimeReportScope, TimeReportStatus } from '@/models/v4/operations';
import en from '@/translations/en.json';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { number?: string; name?: string }) => [key, options?.number, options?.name].filter(Boolean).join(' ') }),
}));
jest.mock('@/components/operations/option-select', () => ({ OptionSelect: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

const report = (overrides: Partial<TimeReport> = {}) => ({ CanAct: false, Status: TimeReportStatus.Submitted, Scope: TimeReportScope.Deployment, ReportNumber: 3, ...overrides }) as TimeReport;

const props = (overrides: Record<string, unknown> = {}) => ({
  dateKey: '2026-09-26',
  report: null as TimeReport | null,
  entries: [],
  subjects: [],
  names: {},
  scopeLabel: 'Engine 41',
  isCrew: false,
  coveredBy: null as TimeReport | null,
  issues: [],
  warnings: [],
  canCreate: true,
  canApprove: false,
  canWrite: () => true,
  dirty: false,
  busy: false,
  onStart: jest.fn(),
  onChange: jest.fn(),
  onSave: jest.fn(),
  onSubmit: jest.fn(),
  onSign: jest.fn(),
  onApprove: jest.fn(),
  ...overrides,
});

describe('TimeReportEditor report numbers', () => {
  it('shows an issued number as issued, without a "#" in front of it', () => {
    const screen = render(<TimeReportEditor {...props({ report: report({ Scope: TimeReportScope.Crew, DisplayNumber: 'CTR-2026-0003' }) })} />);

    expect(screen.getByText('operations.time.crewReport CTR-2026-0003 Engine 41')).toBeTruthy();
  });

  it('keeps the "#" on a plain number', () => {
    const screen = render(<TimeReportEditor {...props({ report: report() })} />);

    expect(screen.getByText('operations.time.report #3')).toBeTruthy();
  });

  it('names the report that already covers the time the same way', () => {
    const screen = render(<TimeReportEditor {...props({ coveredBy: report({ Scope: TimeReportScope.Individual, DisplayNumber: 'ITR-2026-0007' }) })} />);

    expect(screen.getByText('operations.time.coveredBy ITR-2026-0007')).toBeTruthy();
  });

  it('leaves the "#" to the number label rather than the translation', () => {
    const { report: single, crewReport, individualReport, coveredBy } = en.operations.time;

    for (const template of [single, crewReport, individualReport, coveredBy]) {
      expect(template).toContain('{{number}}');
      expect(template).not.toContain('#{{number}}');
    }
  });
});
