# Audio Stream Store Refactoring

## Expo SDK 56 migration requirement

Before upgrading Dispatch to Expo SDK 56, upgrade `expo-audio` to the SDK 56-compatible version and replace all remaining `expo-av` audio usage with `expo-audio`. SDK 56 no longer provides the legacy Expo Modules Core header required by `expo-av` 16, so leaving `expo-av` installed can break the iOS archive build.

Migration checklist:

- Migrate `src/hooks/use-ptt.ts`, `src/components/calls/call-audio-modal.tsx`, `src/stores/app/audio-stream-store.ts`, and `src/services/audio.service.ts` to `createAudioPlayer`, `setAudioModeAsync`, `AudioPlayer`, and `playbackStatusUpdate`.
- Remove `expo-av` from `package.json`, the lockfile, tests/mocks, and the Expo Doctor exclusion after no imports remain.
- Keep this as an audio-only migration. Dispatch does not currently use the `expo-av` video component, so `expo-video` is not required for this change.
- Re-test remote MP3 streams on physical iOS and Android devices. This store originally moved to `expo-av` because remote streams had problems with the earlier `expo-audio` implementation.
- Also test PTT, call audio, background playback, interruptions, and Bluetooth/headset routing before release.

Do not copy an SDK 56 implementation back into the current SDK 54 app unchanged. Dispatch's current `expo-audio` 1.1 API does not expose SDK 56 options such as `preferredForwardBufferDuration` or playback `status.error`.

## Overview

The audio stream store has been refactored to use `expo-av` instead of `expo-audio` to resolve issues with playing remote MP3 streams over the internet in the new Expo architecture.

## Key Changes

### 1. Replaced expo-audio with expo-av

**Before:**
```typescript
import { type AudioPlayer, createAudioPlayer } from 'expo-audio';
```

**After:**
```typescript
import { Audio, type AVPlaybackSource, type AVPlaybackStatus } from 'expo-av';
```

### 2. Updated Audio Player Management

**Before:**
- Used `createAudioPlayer()` function
- Audio player instance stored as `AudioPlayer`

**After:**
- Uses `Audio.Sound.createAsync()` method
- Audio player instance stored as `Audio.Sound`

### 3. Enhanced Audio Configuration

Added proper audio mode configuration for streaming:

```typescript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  staysActiveInBackground: true,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
});
```

### 4. Improved State Management

Added new state properties for better stream status tracking:

```typescript
interface AudioStreamState {
  // ... existing properties
  isLoading: boolean;        // Track loading state
  isBuffering: boolean;      // Track buffering state
  soundObject: Audio.Sound | null; // Sound instance
}
```

### 5. Better Error Handling

Enhanced error handling with proper cleanup and status updates.

## Installation

Make sure you have `expo-av` installed:

```bash
yarn add expo-av
```

## Usage Example

```typescript
import { useAudioStreamStore } from '@/stores/app/audio-stream-store';

const MyComponent = () => {
  const {
    availableStreams,
    isLoadingStreams,
    currentStream,
    isPlaying,
    isLoading,
    isBuffering,
    fetchAvailableStreams,
    playStream,
    stopStream,
  } = useAudioStreamStore();

  useEffect(() => {
    fetchAvailableStreams();
  }, []);

  const handlePlay = async (stream) => {
    try {
      await playStream(stream);
    } catch (error) {
      console.error('Failed to play stream:', error);
    }
  };

  // ... render logic
};
```

## Benefits

1. **Better Remote Streaming Support**: `expo-av` provides more robust support for remote MP3 streams
2. **Improved Audio Configuration**: Proper audio mode settings for background playback and silent mode
3. **Enhanced Error Handling**: Better error recovery and cleanup
4. **Loading States**: More granular loading and buffering states for better UX
5. **Memory Management**: Proper cleanup of audio resources

## Migration Notes

If you were using the previous audio stream store:

1. Replace any direct `audioPlayer` references with `soundObject`
2. Update any custom audio handling code to use `expo-av` APIs
3. The store API remains largely the same, so most usage code should work without changes

## Troubleshooting

### Common Issues

1. **Audio not playing on iOS in silent mode**: Make sure `playsInSilentModeIOS: true` is set
2. **Buffering issues**: The store now properly tracks buffering state - use `isBuffering` to show loading indicators
3. **Background playback**: Ensure your app has proper background audio permissions configured

### Audio Permissions

Make sure your app's configuration includes proper audio permissions:

**app.json/app.config.js:**
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    },
    "android": {
      "permissions": [
        "android.permission.RECORD_AUDIO"
      ]
    }
  }
}
```
