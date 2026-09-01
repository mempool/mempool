import { inject, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';

export const SERVICES_POPUP_ACTION = new InjectionToken<() => void>('SERVICES_POPUP_ACTION', {
  providedIn: 'root',
  factory: () => {
    const router = inject(Router);
    return () => router.navigate(['/']);
  },
});