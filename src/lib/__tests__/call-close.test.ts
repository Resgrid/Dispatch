import { getCallCloseErrorMessage, isCallCloseRejection } from '@/lib/call-close';

const axiosError = (response?: { status: number; data?: unknown }) => Object.assign(new Error(response ? `Request failed with status code ${response.status}` : 'Network Error'), { isAxiosError: true, response });

const ACTIVE_COMMAND = 'This call has an active incident command. Close the incident command first, then close the call.';

describe('call close helpers', () => {
  it('reads the plain-text reason of a 400', () => {
    expect(getCallCloseErrorMessage(axiosError({ status: 400, data: `  ${ACTIVE_COMMAND}  ` }))).toBe(ACTIVE_COMMAND);
  });

  it('reads a JSON reason (Message, then detail/title)', () => {
    expect(getCallCloseErrorMessage(axiosError({ status: 400, data: { Message: 'Call is already closed' } }))).toBe('Call is already closed');
    expect(getCallCloseErrorMessage(axiosError({ status: 400, data: { title: 'One or more validation errors occurred.' } }))).toBe('One or more validation errors occurred.');
  });

  it('has no reason for network and server failures, empty bodies or HTML pages', () => {
    expect(getCallCloseErrorMessage(axiosError())).toBeNull();
    expect(getCallCloseErrorMessage(axiosError({ status: 500, data: 'Server exploded' }))).toBeNull();
    expect(getCallCloseErrorMessage(axiosError({ status: 400, data: '' }))).toBeNull();
    expect(getCallCloseErrorMessage(axiosError({ status: 400, data: '<html><body>Bad Request</body></html>' }))).toBeNull();
    expect(getCallCloseErrorMessage(new Error('boom'))).toBeNull();
  });

  it('treats 4xx (except timeouts and rate limits) as a refusal', () => {
    expect(isCallCloseRejection(axiosError({ status: 400 }))).toBe(true);
    expect(isCallCloseRejection(axiosError({ status: 404 }))).toBe(true);
    expect(isCallCloseRejection(axiosError({ status: 408 }))).toBe(false);
    expect(isCallCloseRejection(axiosError({ status: 429 }))).toBe(false);
    expect(isCallCloseRejection(axiosError({ status: 503 }))).toBe(false);
    expect(isCallCloseRejection(axiosError())).toBe(false);
  });
});
