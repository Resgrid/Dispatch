(function (window) {
    window.env = window.env || {};
  
    // Environment variables
    window['env']['baseApiUrl'] = '${BASE_API_URL}';
    window['env']['resgridApiUrl'] = '${API_URL}';
    window['env']['channelUrl'] = '${CHANNEL_URL}';
    window['env']['channelHubName'] = '${CHANNEL_HUB_NAME}';
    window['env']['logLevel'] = '${LOG_LEVEL}';
    window['env']['what3WordsKey'] = '${W3W_KEY}';
    window['env']['isDemo'] = '${IS_DEMO}';
    window['env']['demoToken'] = '${DEMO_TOKEN}';
    window['env']['osmMapKey'] = '${OSM_MAP_KEY}';
    window['env']['mapTilerKey'] = '${MAPTILER_KEY}';
    window['env']['googleMapsKey'] = '${GOOGLE_MAPS_KEY}';
    window['env']['loggingKey'] = '${LOGGING_KEY}';
  })(this);