/**
 * SignalR binds hub arguments positionally and rejects an invocation that supplies
 * fewer arguments than the hub method declares — C# default values do not make a
 * parameter optional on the wire. These tests pin the argument counts against the
 * ChatHub signatures so a short invoke can never silently strand the client outside
 * its channel groups again:
 *
 *   JoinChannel(string channelId, int? asUnitId)
 *   Typing(string channelId, string displayName, bool isTyping, int? asUnitId)
 *   MarkRead(string channelId, long seq, int? asUnitId)
 *   SetActiveChannel(string channelId, int? asUnitId)
 */
const mockInvoke = jest.fn().mockResolvedValue(undefined);

jest.mock('@/services/signalr.service', () => ({
  signalRService: { invoke: mockInvoke },
}));

jest.mock('@/lib/env', () => ({
  Env: { CHAT_HUB_NAME: 'chatHub' },
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() },
}));

jest.mock('@/lib/i18n/utils', () => ({ translate: (key: string) => key }));

jest.mock('@/lib/storage', () => ({ zustandStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));

jest.mock('@/api/chat/chat', () => ({
  getChannels: jest.fn().mockResolvedValue({ Data: [] }),
  getMessages: jest.fn().mockResolvedValue({ Data: [] }),
  getMembers: jest.fn().mockResolvedValue({ Data: [] }),
  getMyPendingAcks: jest.fn().mockResolvedValue({ Data: [] }),
  markRead: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/api/chat/chatbot', () => ({
  getChatbotChannel: jest.fn(),
  sendChatbotMessage: jest.fn(),
  newChatbotSession: jest.fn(),
}));

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: { getState: () => ({ userId: 'user-1', profile: { name: 'Test User' } }) },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: { getState: () => ({ showToast: jest.fn() }) },
}));

// Loaded lazily so the mock factories above run after their `mock*` consts exist.
type ChatStoreApi = typeof import('../store').useChatStore;
let useChatStore: ChatStoreApi;

beforeAll(() => {
  useChatStore = require('../store').useChatStore as ChatStoreApi;
});

describe('chat hub invocations', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(undefined);
    useChatStore.setState({ messagesByChannel: {}, channels: [] });
  });

  it('sends both JoinChannel arguments', async () => {
    await useChatStore.getState().joinChannel('channel-1');

    expect(mockInvoke).toHaveBeenCalledWith('chatHub', 'JoinChannel', 'channel-1', null);
  });

  it('sends both SetActiveChannel arguments, with null clearing the marker', () => {
    useChatStore.getState().setActiveChannel('channel-1');
    expect(mockInvoke).toHaveBeenCalledWith('chatHub', 'SetActiveChannel', 'channel-1', null);

    mockInvoke.mockClear();
    useChatStore.getState().setActiveChannel(null);
    expect(mockInvoke).toHaveBeenCalledWith('chatHub', 'SetActiveChannel', null, null);
  });

  it('sends all four Typing arguments in hub order', () => {
    useChatStore.getState().sendTyping('channel-1', true);

    expect(mockInvoke).toHaveBeenCalledWith('chatHub', 'Typing', 'channel-1', 'Test User', true, null);
  });

  it('sends all three MarkRead arguments', async () => {
    useChatStore.setState({
      messagesByChannel: {
        'channel-1': [
          {
            ChatMessageId: 'm1',
            ChatChannelId: 'channel-1',
            MessageSeq: 42,
            SenderParticipantType: 0,
            SenderUserId: 'user-2',
            SenderDisplayName: 'Other',
            Body: 'hi',
            MessageType: 0,
            Priority: 0,
            ThreadRootMessageId: null,
            ThreadReplyCount: 0,
            AlsoSendToChannel: false,
            MetadataJson: null,
            ClientMessageId: 'c1',
            SentOn: new Date(0).toISOString(),
            Reactions: [],
            Attachments: [],
          },
        ],
      },
    } as unknown as Parameters<typeof useChatStore.setState>[0]);

    await useChatStore.getState().markChannelRead('channel-1');

    expect(mockInvoke).toHaveBeenCalledWith('chatHub', 'MarkRead', 'channel-1', 42, null);
  });
});

describe('incoming message normalization', () => {
  beforeEach(() => {
    useChatStore.setState({ messagesByChannel: {}, channels: [] });
  });

  it('fills in collections the hub payload omits', () => {
    // The hub sends the message DTO as a JSON string and drops empty collections.
    useChatStore.getState().handleMessageReceived(JSON.stringify({ ChatMessageId: 'm1', ChatChannelId: 'channel-1', MessageSeq: 10, Body: 'hi', SentOn: new Date(0).toISOString() }));

    const stored = useChatStore.getState().messagesByChannel['channel-1']?.[0];
    expect(stored?.Reactions).toEqual([]);
    expect(stored?.Attachments).toEqual([]);
  });

  it('keeps existing reactions when a later payload omits them', () => {
    useChatStore.getState().handleMessageReceived({ ChatMessageId: 'm1', ChatChannelId: 'channel-1', MessageSeq: 10, Body: 'hi', SentOn: new Date(0).toISOString(), Reactions: [{ Emoji: '\u{1F44D}', UserId: 'user-2' }] });
    useChatStore.getState().handleMessageEdited({ ChatMessageId: 'm1', ChatChannelId: 'channel-1', MessageSeq: 10, Body: 'hi (edited)', SentOn: new Date(0).toISOString() });

    const stored = useChatStore.getState().messagesByChannel['channel-1']?.[0];
    expect(stored?.Body).toBe('hi (edited)');
    expect(stored?.Reactions).toHaveLength(1);
  });
});

describe('chat presence events', () => {
  beforeEach(() => {
    useChatStore.setState({ presence: new Set<string>() });
  });

  it('accepts the hub positional (userId, isOnline) form', () => {
    useChatStore.getState().handlePresenceChanged('user-2', true);
    expect(useChatStore.getState().presence.has('user-2')).toBe(true);

    useChatStore.getState().handlePresenceChanged('user-2', false);
    expect(useChatStore.getState().presence.has('user-2')).toBe(false);
  });

  it('still accepts an object payload', () => {
    useChatStore.getState().handlePresenceChanged({ UserId: 'user-3', IsOnline: true });
    expect(useChatStore.getState().presence.has('user-3')).toBe(true);
  });
});

describe('chat typing events', () => {
  beforeEach(() => {
    useChatStore.setState({ typingByChannel: {} });
  });

  it('reads the hub payload ChannelId field', () => {
    useChatStore.getState().handleTyping({ ChannelId: 'channel-1', UserId: 'user-2', DisplayName: 'Other', IsTyping: true });

    expect(useChatStore.getState().typingByChannel['channel-1']?.[0]?.displayName).toBe('Other');
  });

  it('reads a camelCase hub payload', () => {
    useChatStore.getState().handleTyping({ channelId: 'channel-1', userId: 'user-2', displayName: 'Other', isTyping: true });

    expect(useChatStore.getState().typingByChannel['channel-1']?.[0]?.userId).toBe('user-2');
  });
});
