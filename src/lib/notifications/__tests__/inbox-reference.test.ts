import { referenceFromEventCode, referenceHref } from '../inbox-reference';

describe('inbox references', () => {
  it('reads call dispatch codes, which carry no separator', () => {
    expect(referenceFromEventCode('C1234')).toEqual({ referenceType: 'call', referenceId: '1234' });
    expect(referenceFromEventCode('c:77')).toEqual({ referenceType: 'call', referenceId: '77' });
  });

  it('does not read a communication-test token as a call', () => {
    expect(referenceFromEventCode('CT:9f2c')).toBeUndefined();
  });

  it('reads direct and group chat codes', () => {
    expect(referenceFromEventCode('t:9a2b')).toEqual({ referenceType: 'chat', referenceId: '9a2b' });
    expect(referenceFromEventCode('G:7f1c')).toEqual({ referenceType: 'chat', referenceId: '7f1c' });
  });

  it('refuses ids that could steer the router and codes it has no screen for', () => {
    expect(referenceFromEventCode('g:../call/9')).toBeUndefined();
    expect(referenceFromEventCode('t:a?x=1')).toBeUndefined();
    expect(referenceFromEventCode('NWO:0b7c3e52-2f4a-4d0e-9a57-1f7a0c9d6e11')).toBeUndefined();
    expect(referenceFromEventCode('M5678')).toBeUndefined();
    expect(referenceFromEventCode('')).toBeUndefined();
    expect(referenceFromEventCode(undefined)).toBeUndefined();
    expect(referenceFromEventCode(42)).toBeUndefined();
  });

  it('builds the route for each reference and refuses unsafe ids', () => {
    expect(referenceHref('call', '1234')).toEqual({ pathname: '/call/[id]', params: { id: '1234' } });
    expect(referenceHref('chat', '7f1c')).toEqual({ pathname: '/chat/[channelId]', params: { channelId: '7f1c' } });
    expect(referenceHref('chat', '../settings')).toBeNull();
    expect(referenceHref('note', 'n-1')).toBeNull();
  });
});
