export const environment = {
  production: true,
  baseApiUrl: window["env"]["baseApiUrl"] || 'https://api.resgrid.com',
  resgridApiUrl: window["env"]["resgridApiUrl"] || '/api/v4',
  channelUrl: window["env"]["channelUrl"] || 'https://events.resgrid.com/',
  channelHubName: window["env"]["channelHubName"] || 'eventingHub',
  realtimeGeolocationHubName: window["env"]["realtimeGeolocationHubName"] || 'geolocationHub',
  logLevel: window["env"]["logLevel"] || 0,
  what3WordsKey: window["env"]["what3WordsKey"] || 'W3WKEY',
  isDemo: window["env"]["isDemo"] || false,
  demoToken: window["env"]["demoToken"] || 'DEMOTOKEN',
  version: '99.99.99',
  osmMapKey: window["env"]["osmMapKey"] || 'OSMKEY',
  mapTilerKey: window["env"]["mapTilerKey"] || 'MTKEY',
  googleMapsKey: window["env"]["googleMapsKey"] || 'GOOGLEMAPKEY',
  loggingKey: window["env"]["loggingKey"] || 'LOGGINGKEY',
  appKey: window["env"]["appKey"] || 'APPKEY'
};