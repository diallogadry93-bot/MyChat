import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

/**
 * Register for push notifications and return the Expo push token.
 * Token is stored server-side against the user's device row.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name:       'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A56DB',
      sound:      'notification.wav',
    })

    await Notifications.setNotificationChannelAsync('calls', {
      name:       'Calls',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#22C55E',
    })
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env['EXPO_PUBLIC_EAS_PROJECT_ID'],
  })

  return token.data
}

export function useNotificationListeners(
  onMessage?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void,
) {
  const messageListener = Notifications.addNotificationReceivedListener(
    n => onMessage?.(n)
  )
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    r => onResponse?.(r)
  )

  return () => {
    Notifications.removeNotificationSubscription(messageListener)
    Notifications.removeNotificationSubscription(responseListener)
  }
}
