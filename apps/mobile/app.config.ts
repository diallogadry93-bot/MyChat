import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name:        'MyChat',
  slug:        'mychat',
  version:     '1.0.0',
  orientation: 'portrait',
  icon:        './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image:           './assets/splash.png',
    resizeMode:      'contain',
    backgroundColor: '#1A56DB',
  },
  ios: {
    supportsTablet:     true,
    bundleIdentifier:   'com.mychat.app',
    buildNumber:        '1',
    infoPlist: {
      NSCameraUsageDescription:        'MyChat uses your camera for video calls.',
      NSMicrophoneUsageDescription:    'MyChat uses your microphone for voice and video calls.',
      NSPhotoLibraryUsageDescription:  'MyChat needs access to your photos to share media.',
      NSFaceIDUsageDescription:        'MyChat uses Face ID to unlock the app.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1A56DB',
    },
    package:     'com.mychat.app',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon:  './assets/notification-icon.png',
        color: '#1A56DB',
        sounds: ['./assets/notification.wav'],
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'MyChat uses Face ID to unlock the app.' },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: 'your-eas-project-id' },
  },
}

export default config
