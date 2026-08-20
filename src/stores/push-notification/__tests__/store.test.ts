import { logger } from '@/lib/logging';
import { usePushNotificationModalStore } from '../store';

// Mock logger service
jest.mock('@/lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('usePushNotificationModalStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = usePushNotificationModalStore.getState();
    store.hideNotificationModal();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = usePushNotificationModalStore.getState();
      
      expect(state.isOpen).toBe(false);
      expect(state.notification).toBeNull();
    });
  });

  describe('showNotificationModal', () => {
    it('should show modal with call notification', () => {
      const callData = {
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'call',
        id: '1234',
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      });
    });

    it('should show modal with message notification', () => {
      const messageData = {
        eventCode: 'M:5678',
        title: 'New Message',
        body: 'You have a new message from dispatch',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(messageData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'message',
        id: '5678',
        eventCode: 'M:5678',
        title: 'New Message',
        body: 'You have a new message from dispatch',
      });
    });

    it('should show modal with chat notification', () => {
      const chatData = {
        eventCode: 'T:9101',
        title: 'Chat Message',
        body: 'New message in chat',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(chatData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'chat',
        id: '9101',
        eventCode: 'T:9101',
        title: 'Chat Message',
        body: 'New message in chat',
      });
    });

    it('should show modal with group chat notification', () => {
      const groupChatData = {
        eventCode: 'G:1121',
        title: 'Group Chat',
        body: 'New message in group chat',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(groupChatData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'group-chat',
        id: '1121',
        eventCode: 'G:1121',
        title: 'Group Chat',
        body: 'New message in group chat',
      });
    });

    it('should handle unknown notification type', () => {
      const unknownData = {
        eventCode: 'X:9999',
        title: 'Unknown',
        body: 'Unknown notification type',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(unknownData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'unknown',
        id: '9999',
        eventCode: 'X:9999',
        title: 'Unknown',
        body: 'Unknown notification type',
      });
    });

    it('should handle notification without valid eventCode', () => {
      const dataWithInvalidEventCode = {
        eventCode: 'INVALID',
        title: 'Invalid Event Code',
        body: 'Notification with invalid event code',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(dataWithInvalidEventCode);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'unknown',
        id: '',
        eventCode: 'INVALID',
        title: 'Invalid Event Code',
        body: 'Notification with invalid event code',
      });
    });

    it('should log info message when showing notification', () => {
      const callData = {
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      expect(logger.info).toHaveBeenCalledWith({
        message: 'Showing push notification modal',
        context: {
          type: 'call',
          id: '1234',
          eventCode: 'C:1234',
        },
      });
    });
  });

  describe('hideNotificationModal', () => {
    it('should hide modal and clear notification', () => {
      // First show a notification
      const callData = {
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      // Verify it's shown
      let state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).not.toBeNull();

      // Hide it
      store.hideNotificationModal();

      // Verify it's hidden
      state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.notification).toBeNull();
    });

    it('should log info message when hiding notification', () => {
      const store = usePushNotificationModalStore.getState();
      store.hideNotificationModal();

      expect(logger.info).toHaveBeenCalledWith({
        message: 'Hiding push notification modal',
      });
    });
  });

  describe('parseNotification', () => {
    it('should parse call event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      });

      expect(parsed.type).toBe('call');
      expect(parsed.id).toBe('1234');
      expect(parsed.eventCode).toBe('C:1234');
    });

    it('should parse message event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'M:5678',
        title: 'New Message',
        body: 'Message content',
      });

      expect(parsed.type).toBe('message');
      expect(parsed.id).toBe('5678');
      expect(parsed.eventCode).toBe('M:5678');
    });

    it('should parse chat event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'T:9101',
        title: 'Chat Message',
        body: 'Chat content',
      });

      expect(parsed.type).toBe('chat');
      expect(parsed.id).toBe('9101');
      expect(parsed.eventCode).toBe('T:9101');
    });

    it('should parse group chat event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'G:1121',
        title: 'Group Chat',
        body: 'Group chat content',
      });

      expect(parsed.type).toBe('group-chat');
      expect(parsed.id).toBe('1121');
      expect(parsed.eventCode).toBe('G:1121');
    });

    it('should handle lowercase event codes', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'c:1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      });

      expect(parsed.type).toBe('call');
      expect(parsed.id).toBe('1234');
      expect(parsed.eventCode).toBe('c:1234');
    });

    it('should parse legacy event code without colon (first char prefix)', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      });

      expect(parsed.type).toBe('call');
      expect(parsed.id).toBe('1234');
      expect(parsed.eventCode).toBe('C1234');
    });

    it('should parse legacy message event code without colon', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'M5678',
        title: 'New Message',
        body: 'Message content',
      });

      expect(parsed.type).toBe('message');
      expect(parsed.id).toBe('5678');
      expect(parsed.eventCode).toBe('M5678');
    });

    it('should split on the first colon only so ids containing colons survive', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'g:abc:def',
        title: 'Group Chat',
        body: 'Group chat content',
      });

      expect(parsed.type).toBe('group-chat');
      expect(parsed.id).toBe('abc:def');
      expect(parsed.eventCode).toBe('g:abc:def');
    });

    it('should handle invalid event code format', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'INVALID',
        title: 'Invalid',
        body: 'Invalid format',
      });

      expect(parsed.type).toBe('unknown');
      expect(parsed.id).toBe('');
      expect(parsed.eventCode).toBe('INVALID');
    });

    it('should handle empty event code', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: '',
        title: 'Empty Event Code',
        body: 'Empty event code',
      });

      expect(parsed.type).toBe('unknown');
      expect(parsed.id).toBe('');
      expect(parsed.eventCode).toBe('');
    });
  });
});
