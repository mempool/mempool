import {Injectable, OnDestroy} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  activeNotification: Notification;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }

  public static supportsNotifications() {
    if (!window || !('Notification' in window)) {
      return false;
    }

    return true;
  }

  private onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // The tab has become visible so clear the now-stale Notification.
      this.closeNotification();
    }
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

    if (document.visibilityState !== 'visible') {
      this.activeNotification = new Notification(title, { body });

      return true;
    }

    return false;
  }

  public closeNotification() {
    if (this.activeNotification) {
      if (!NotificationService.supportsNotifications()) {
        return false;
      }

      this.activeNotification.close();

      return true;
    }

    return false;
  }

  ngOnDestroy() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }
}
