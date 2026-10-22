import { saveUnitStatus } from '@/api/units/unitStatuses';
import { CustomStateDetailType, DestinationEntityType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';

import { useUnitBulkActionsStore } from '../unit-bulk-actions-store';

jest.mock('@/api/units/unitStatuses', () => ({
  saveUnitStatus: jest.fn(),
}));

const mockSaveUnitStatus = saveUnitStatus as jest.MockedFunction<typeof saveUnitStatus>;

const status = (Id: number, Text: string, Detail: number): StatusesResultData => ({ Id, Text, Detail, Note: 0 }) as StatusesResultData;
const call: CallResultData = { CallId: '1234', Number: '20-10-2026-4', Name: 'Agressie', State: 0 } as CallResultData;
const hospital: PoiResultData = { PoiId: 77, Name: 'AZ Sint-Elisabeth Zottegem' } as PoiResultData;

// The same "Departing to hospital" status in the ambulance's and the MUG's status sets
const ambulanceDeparting = status(201, 'Departing to hospital', CustomStateDetailType.Pois);
const mugDeparting = status(301, 'Departing to hospital', CustomStateDetailType.CallsAndPois);
const ambulanceOnScene = status(200, 'On Scene', CustomStateDetailType.Calls);
const mugOnScene = status(300, 'On Scene', CustomStateDetailType.Calls);

const payloadFor = (unitId: string) => mockSaveUnitStatus.mock.calls.map(([input]) => input).find((input) => input.Id === unitId)!;

describe('useUnitBulkActionsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveUnitStatus.mockResolvedValue({} as any);
    useUnitBulkActionsStore.getState().reset();
  });

  describe('selection', () => {
    it('starts a selection with the given units, without duplicates', () => {
      useUnitBulkActionsStore.getState().startSelection(['zw', 'zw', 'mug']);

      expect(useUnitBulkActionsStore.getState().isSelectionMode).toBe(true);
      expect(useUnitBulkActionsStore.getState().selectedUnitIds).toEqual(['zw', 'mug']);
    });

    it('toggles units in and out of the selection', () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw']);
      store.toggleUnit('mug');
      expect(useUnitBulkActionsStore.getState().selectedUnitIds).toEqual(['zw', 'mug']);

      useUnitBulkActionsStore.getState().toggleUnit('zw');
      expect(useUnitBulkActionsStore.getState().selectedUnitIds).toEqual(['mug']);
    });

    it('drops the status form when the selection is emptied, and keeps multi-select on', () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw']);
      store.setSelectedStatusKey('on scene');
      store.chooseDestination('call', call);

      useUnitBulkActionsStore.getState().toggleUnit('zw');

      const state = useUnitBulkActionsStore.getState();
      expect(state.isSelectionMode).toBe(true);
      expect(state.selectedStatusKey).toBeNull();
      expect(state.statusSelectedCall).toBeNull();
      expect(state.isDestinationChosen).toBe(false);
    });

    it('adds units for select all without duplicating ones already selected', () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw']);
      store.addUnits(['zw', 'mug', 'brw']);

      expect(useUnitBulkActionsStore.getState().selectedUnitIds).toEqual(['zw', 'mug', 'brw']);
    });

    it('ends multi-select with everything reset', () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw', 'mug']);
      store.setStatusNote('note');

      useUnitBulkActionsStore.getState().endSelection();

      const state = useUnitBulkActionsStore.getState();
      expect(state.isSelectionMode).toBe(false);
      expect(state.selectedUnitIds).toEqual([]);
      expect(state.statusNote).toBe('');
    });
  });

  describe('destination', () => {
    it('applies the default call until the dispatcher picks a destination', () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw', 'mug']);
      store.applyDefaultDestinationCall(call);
      expect(useUnitBulkActionsStore.getState().statusSelectedCall).toBe(call);

      useUnitBulkActionsStore.getState().chooseDestination('poi', hospital);
      useUnitBulkActionsStore.getState().applyDefaultDestinationCall(null);

      const state = useUnitBulkActionsStore.getState();
      expect(state.statusDestinationType).toBe('poi');
      expect(state.statusSelectedPoi).toBe(hospital);
      expect(state.statusSelectedCall).toBeNull();
    });

    it('keeps "No destination" when the dispatcher chose it', () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw']);
      store.chooseDestination('none');
      useUnitBulkActionsStore.getState().applyDefaultDestinationCall(call);

      expect(useUnitBulkActionsStore.getState().statusDestinationType).toBe('none');
    });
  });

  describe('submitStatus', () => {
    it("sends each unit its own status id and only the destination its own status takes", async () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw', 'mug']);
      store.chooseDestination('call', call);
      store.setStatusNote('Both units leave the scene');

      const ok = await useUnitBulkActionsStore.getState().submitStatus([
        { unitId: 'zw', status: ambulanceDeparting },
        { unitId: 'mug', status: mugDeparting },
      ]);

      expect(ok).toBe(true);
      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(2);
      // The ambulance's status takes POIs only: the call is not sent with it
      expect(payloadFor('zw')).toMatchObject({ Type: '201', RespondingTo: '', RespondingToType: null, Note: 'Both units leave the scene' });
      expect(payloadFor('mug')).toMatchObject({ Type: '301', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call, Note: 'Both units leave the scene' });
      // One timestamp for the group
      expect(payloadFor('zw').Timestamp).toBe(payloadFor('mug').Timestamp);
    });

    it('keeps the selection and destination after a successful submit so the units can move on together', async () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw', 'mug']);
      store.chooseDestination('poi', hospital);
      store.setSelectedStatusKey('departing to hospital');

      await useUnitBulkActionsStore.getState().submitStatus([
        { unitId: 'zw', status: ambulanceDeparting },
        { unitId: 'mug', status: mugDeparting },
      ]);

      const state = useUnitBulkActionsStore.getState();
      expect(state.selectedUnitIds).toEqual(['zw', 'mug']);
      expect(state.statusSelectedPoi).toBe(hospital);
      expect(state.selectedStatusKey).toBeNull();
      expect(state.statusNote).toBe('');
    });

    it('reports the units that failed and retries only those', async () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw', 'mug']);
      store.setSelectedStatusKey('on scene');
      mockSaveUnitStatus.mockImplementation(async (input) => {
        if (input.Id === 'mug') throw new Error('Network error');
        return {} as any;
      });
      const targets = [
        { unitId: 'zw', status: ambulanceOnScene },
        { unitId: 'mug', status: mugOnScene },
      ];

      await expect(useUnitBulkActionsStore.getState().submitStatus(targets)).resolves.toBe(false);
      expect(useUnitBulkActionsStore.getState().failedUnitIds).toEqual(['mug']);
      expect(useUnitBulkActionsStore.getState().statusError).toBe('Network error');
      expect(useUnitBulkActionsStore.getState().selectedStatusKey).toBe('on scene');

      mockSaveUnitStatus.mockClear();
      mockSaveUnitStatus.mockResolvedValue({} as any);
      await expect(useUnitBulkActionsStore.getState().submitStatus(targets)).resolves.toBe(true);

      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1);
      expect(mockSaveUnitStatus.mock.calls[0][0].Id).toBe('mug');
      expect(useUnitBulkActionsStore.getState().failedUnitIds).toEqual([]);
    });

    it('sends to every unit again once the status is changed after a partial failure', async () => {
      const store = useUnitBulkActionsStore.getState();
      store.startSelection(['zw', 'mug']);
      mockSaveUnitStatus.mockRejectedValueOnce(new Error('Network error'));
      await useUnitBulkActionsStore.getState().submitStatus([
        { unitId: 'zw', status: ambulanceOnScene },
        { unitId: 'mug', status: mugOnScene },
      ]);
      expect(useUnitBulkActionsStore.getState().failedUnitIds).toEqual(['zw']);

      useUnitBulkActionsStore.getState().setSelectedStatusKey('departing to hospital');

      expect(useUnitBulkActionsStore.getState().failedUnitIds).toEqual([]);
    });
  });
});
