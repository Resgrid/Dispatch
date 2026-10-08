import { buildAddResourcesUpdateRequest, EMPTY_DISPATCH_SELECTION } from '@/lib/dispatch-helpers';
import { CallResultData } from '@/models/v4/calls/callResultData';

describe('buildAddResourcesUpdateRequest', () => {
  const call = Object.assign(new CallResultData(), { CallId: '42', Name: 'Fire', Nature: 'Smoke', Priority: 1, IncidentId: 'INC-7', ExternalId: 'EXT-1', ReferenceId: 'REF-1' });

  it('keeps the incident number as the incident number', () => {
    const request = buildAddResourcesUpdateRequest(call, [], { ...EMPTY_DISPATCH_SELECTION, units: ['5'] });

    expect(request.incidentId).toBe('INC-7');
    expect(request.externalId).toBe('EXT-1');
    expect(request.referenceId).toBe('REF-1');
  });

  it('does not touch linked calls or protocols', () => {
    // Sending the incident number as LinkedCallId made EditCall try to link the call to it; leaving both
    // out also tells the server this flow does not enforce them.
    const request = buildAddResourcesUpdateRequest(call, [], { ...EMPTY_DISPATCH_SELECTION, units: ['5'] });

    expect(request.linkedCallId).toBeUndefined();
    expect(request.protocolIds).toBeUndefined();
  });
});
