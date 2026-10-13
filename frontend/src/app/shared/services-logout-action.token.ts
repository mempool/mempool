import { InjectionToken } from '@angular/core';

export const SERVICES_LOGOUT_ACTION = new InjectionToken<() => void>('SERVICES_LOGOUT_ACTION', {
  providedIn: 'root',
  factory: () => () => {},
});