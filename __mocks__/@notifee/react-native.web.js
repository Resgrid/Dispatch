const AndroidImportance = {
  DEFAULT: 3,
  HIGH: 4,
  LOW: 2,
  MIN: 1,
  NONE: 0,
};

const notifee = {
  registerForegroundService: () => {},
  createChannel: async () => 'mock-channel-id',
  displayNotification: async () => 'mock-notification-id',
  stopForegroundService: async () => undefined,
};

module.exports = { default: notifee, AndroidImportance };
