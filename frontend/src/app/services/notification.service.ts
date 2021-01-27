import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  activeNotification: Notification;

  constructor() {
  }

  private static supportsNotifications() {
    if (!window || !('Notification' in window)) {
      return false;
    }

    return true;
  }

  public async askForNotificationPermission() {
    if (!NotificationService.supportsNotifications()) {
      return false;
    }

    await Notification.requestPermission();

    return this.hasNotificationPermission();
  }

  public hasNotificationPermission() {
    if (!NotificationService.supportsNotifications()) {
      return false;
    }

    return (window.Notification.permission === 'granted');
  }

  public sendNotification(title, body) {
    if (!NotificationService.supportsNotifications()) {
      return false;
    }

    this.closeNotification();

    this.activeNotification = new Notification(title, { body });

    return true;
  }

  public closeNotification() {
    if (!NotificationService.supportsNotifications()) {
      return false;
    }

    if (this.activeNotification) {
      this.activeNotification.close();
    }
  }
}
