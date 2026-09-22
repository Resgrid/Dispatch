const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const SERVICE_NAME = 'app.notifee.core.ForegroundService';

const withForegroundService = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;

    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    mainApplication['service'] = mainApplication['service'] || [];

    // Idempotent: a prebuild that reuses an existing android/ dir already has this service in
    // the base manifest — and non-clean prebuilds have already accumulated duplicates there — so
    // drop every copy before adding the canonical one.
    const serviceEntry = {
      $: {
        'android:name': SERVICE_NAME,
        // microphone only. mediaPlayback and connectedDevice are intentionally absent: this
        // service backs PTT capture, expo-audio owns its own mediaPlayback service for stream
        // playback, and Bluetooth PTT handsets run on the same microphone session. Play rejects
        // foreground-service types whose use case cannot be demonstrated in the app.
        'android:foregroundServiceType': 'microphone',
        'tools:replace': 'android:foregroundServiceType',
      },
    };
    mainApplication['service'] = mainApplication['service'].filter((service) => service?.$?.['android:name'] !== SERVICE_NAME);
    mainApplication['service'].push(serviceEntry);
    return config;
  });
};

module.exports = withForegroundService;
