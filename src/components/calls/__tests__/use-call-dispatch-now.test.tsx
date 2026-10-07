import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { closeCall, dispatchCallNow, getCallExtraData } from '@/api/calls/calls';
import { type DispatchSelection } from '@/stores/dispatch/store';

import { useCallDispatchNow } from '../use-call-dispatch-now';

jest.mock('@/api/common/client', () => ({
  createApiEndpoint: jest.fn(() => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() })),
}));

jest.mock('@/api/calls/calls', () => ({
  buildDispatchList: jest.requireActual('@/api/calls/calls').buildDispatchList,
  closeCall: jest.fn(),
  dispatchCallNow: jest.fn(),
  getCallExtraData: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockShowToast = jest.fn();
jest.mock('@/stores/toast/store', () => ({
  useToastStore: (selector: (state: { showToast: jest.Mock }) => unknown) => selector({ showToast: mockShowToast }),
}));

const mockRefreshQueuedCallLists = jest.fn();
const mockFetchPendingCalls = jest.fn();
jest.mock('@/stores/calls/pending-store', () => ({
  refreshQueuedCallLists: () => mockRefreshQueuedCallLists(),
  usePendingCallsStore: { getState: () => ({ fetchPendingCalls: mockFetchPendingCalls }) },
}));

// The picker itself is covered by its own tests; here only the props the hook hands it matter.
const mockPicker: { props: { isVisible: boolean; onConfirm: (selection: DispatchSelection) => void; onClose: () => void; initialSelection?: DispatchSelection } | null } = { props: null };
jest.mock('../dispatch-selection-modal', () => ({
  DispatchSelectionModal: (props: never) => {
    mockPicker.props = props;
    return null;
  },
}));

const mockDispatchCallNow = dispatchCallNow as jest.MockedFunction<typeof dispatchCallNow>;
const mockGetCallExtraData = getCallExtraData as jest.MockedFunction<typeof getCallExtraData>;
const mockCloseCall = closeCall as jest.MockedFunction<typeof closeCall>;

const selection = (overrides: Partial<DispatchSelection> = {}): DispatchSelection => ({ everyone: false, users: [], groups: [], roles: [], units: [], ...overrides });

let hook!: ReturnType<typeof useCallDispatchNow>;
const Harness: React.FC<{ onDispatched?: (callId: string) => void; onCancelled?: (callId: string) => void }> = (props) => {
  hook = useCallDispatchNow(props);
  return hook.dispatchPicker;
};

/** Opens the picker and confirms it with `picked`, the way the modal does (confirm, then close). */
const pickAndConfirm = async (picked: DispatchSelection) => {
  await act(async () => {
    mockPicker.props?.onConfirm(picked);
    mockPicker.props?.onClose();
  });
};

describe('useCallDispatchNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPicker.props = null;
    mockDispatchCallNow.mockResolvedValue({ Id: '12' } as never);
  });

  it('preselects the proposed dispatch read from the call', async () => {
    mockGetCallExtraData.mockResolvedValueOnce({
      Data: {
        Dispatches: [
          { Type: 'Unit', Id: '5' },
          { Type: 'Personnel', Id: 'abc' },
        ],
      },
    } as never);
    render(<Harness />);

    await act(async () => {
      await hook.openDispatchPicker('12');
    });

    expect(mockGetCallExtraData).toHaveBeenCalledWith('12');
    expect(mockPicker.props?.isVisible).toBe(true);
    expect(mockPicker.props?.initialSelection).toEqual(selection({ units: ['5'], users: ['abc'] }));
  });

  it('uses dispatches the screen already has instead of reading them again', async () => {
    render(<Harness />);

    await act(async () => {
      await hook.openDispatchPicker('12', [{ Type: 'Group', Id: '3' }] as never);
    });

    expect(mockGetCallExtraData).not.toHaveBeenCalled();
    expect(mockPicker.props?.initialSelection).toEqual(selection({ groups: ['3'] }));
  });

  it('dispatches the picked recipients as the replacement list', async () => {
    const onDispatched = jest.fn();
    render(<Harness onDispatched={onDispatched} />);
    await act(async () => {
      await hook.openDispatchPicker('12', []);
    });

    await pickAndConfirm(selection({ units: ['5'], roles: ['7'] }));

    expect(mockDispatchCallNow).toHaveBeenCalledWith('12', 'R:7|U:5');
    expect(mockShowToast).toHaveBeenCalledWith('success', 'calls.dispatch_now_success');
    expect(mockRefreshQueuedCallLists).toHaveBeenCalled();
    expect(onDispatched).toHaveBeenCalledWith('12');
  });

  it('dispatches everyone as "0"', async () => {
    render(<Harness />);
    await act(async () => {
      await hook.openDispatchPicker('12', []);
    });

    await pickAndConfirm(selection({ everyone: true }));

    expect(mockDispatchCallNow).toHaveBeenCalledWith('12', '0');
  });

  it('falls back to the proposed recipients when the pick is empty', async () => {
    render(<Harness />);
    await act(async () => {
      await hook.openDispatchPicker('12', [{ Type: 'Unit', Id: '5' }] as never);
    });

    await pickAndConfirm(selection());

    expect(mockDispatchCallNow).toHaveBeenCalledWith('12', undefined);
  });

  it('lets the server decide when the proposed recipients could not be read', async () => {
    mockGetCallExtraData.mockRejectedValueOnce(new Error('Network Error'));
    render(<Harness />);
    await act(async () => {
      await hook.openDispatchPicker('12');
    });

    expect(mockPicker.props?.initialSelection).toEqual(selection());
    await pickAndConfirm(selection());

    expect(mockDispatchCallNow).toHaveBeenCalledWith('12', undefined);
  });

  it('refuses an empty pick when the call has no proposed recipients', async () => {
    render(<Harness />);
    await act(async () => {
      await hook.openDispatchPicker('12', []);
    });

    await pickAndConfirm(selection());

    expect(mockDispatchCallNow).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('error', 'calls.dispatch_now_no_recipients');
  });

  it('shows the server reason when the dispatch is rejected', async () => {
    mockDispatchCallNow.mockRejectedValueOnce({ response: { status: 400, data: 'Call is not pending or scheduled' } });
    const onDispatched = jest.fn();
    render(<Harness onDispatched={onDispatched} />);
    await act(async () => {
      await hook.openDispatchPicker('12', []);
    });

    await pickAndConfirm(selection({ units: ['5'] }));

    expect(mockShowToast).toHaveBeenCalledWith('error', 'calls.dispatch_now_error: Call is not pending or scheduled');
    expect(onDispatched).not.toHaveBeenCalled();
  });

  it('dispatches a scheduled call with its own list after confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    render(<Harness />);

    act(() => hook.confirmDispatchNow('44'));
    expect(alertSpy).toHaveBeenCalledWith('', 'calls.dispatch_now_confirm', expect.any(Array));
    expect(mockDispatchCallNow).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((b) => b.text === 'calls.dispatch_now')?.onPress?.();
    });

    expect(mockDispatchCallNow).toHaveBeenCalledWith('44', undefined);
    alertSpy.mockRestore();
  });

  it('cancels a pending call as Cancelled after confirmation', async () => {
    mockCloseCall.mockResolvedValueOnce({ Id: '12' } as never);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const onCancelled = jest.fn();
    render(<Harness onCancelled={onCancelled} />);

    act(() => hook.confirmCancelPending('12'));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((b) => b.text === 'pending_calls.cancel_call')?.onPress?.();
    });

    expect(mockCloseCall).toHaveBeenCalledWith({ callId: '12', type: 2 });
    expect(mockShowToast).toHaveBeenCalledWith('success', 'pending_calls.cancel_success');
    expect(mockFetchPendingCalls).toHaveBeenCalled();
    expect(onCancelled).toHaveBeenCalledWith('12');
    alertSpy.mockRestore();
  });
});
