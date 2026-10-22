import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Settings } from '../data/types';
import type { CycleStatus } from '../engines/cycle';
import { toDayNumber } from './dates';

/**
 * Notification Intelligence. Copy is chosen by the user's style. "Discreet"
 * never mentions periods, pain or moods on the lock screen.
 */
export const COPY = {
  checkin: {
    gentle: { title: 'Petal & Pulse', body: 'Would a quick check-in feel helpful today?' },
    discreet: { title: 'Reminder', body: 'You have a moment saved for yourself.' },
    minimal: { title: 'Check-in', body: 'Tap to check in.' },
  },
  headsUp: {
    gentle: { title: 'Petal & Pulse', body: 'Your period may be approaching. Want to prepare a little comfort kit?' },
    discreet: { title: 'Reminder', body: 'A little planning note is waiting for you.' },
    minimal: { title: 'Heads-up', body: 'Open to see your note.' },
  },
} as const;

export function inQuietHours(hhmm: string, start: string, end: string): boolean {
  const m = (s: string) => {
    const [h, mi] = s.split(':').map(Number);
    return h * 60 + mi;
  };
  const t = m(hhmm);
  const a = m(start);
  const b = m(end);
  return a <= b ? t >= a && t < b : t >= a || t < b;
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/** Re-schedule all local notifications from current settings. */
export async function syncNotifications(settings: Settings, status: CycleStatus | null) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (settings.notificationStyle === 'none') return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const style = settings.notificationStyle;

  // Quiet Mode pauses non-essential reminders.
  if (settings.careMode !== 'quiet' && settings.checkinReminderTime && !inQuietHours(settings.checkinReminderTime, settings.quietHoursStart, settings.quietHoursEnd)) {
    const [hour, minute] = settings.checkinReminderTime.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { ...COPY.checkin[style] },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  }
  // Only when a real prediction with at least medium confidence exists.
  if (settings.periodHeadsUp && status?.prediction && status.confidence !== 'low' && status.confidence !== 'insufficient') {
    const days = toDayNumber(status.prediction.nextStartEarliest) - toDayNumber(status.today) - 2;
    if (days >= 1) {
      const date = new Date();
      date.setDate(date.getDate() + days);
      date.setHours(10, 0, 0, 0);
      await Notifications.scheduleNotificationAsync({
        content: { ...COPY.headsUp[style] },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
  }
}
