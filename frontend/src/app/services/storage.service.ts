import { Injectable } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor(private router: Router, private route: ActivatedRoute) {
    this.setDefaultValueIfNeeded('graphWindowPreference', '2h');
    this.setDefaultValueIfNeeded('miningWindowPreference', '1w');
  }

  setDefaultValueIfNeeded(key: string, defaultValue: string) {
    const graphWindowPreference: string = this.getValue(key);
    const fragment = window.location.hash.replace('#', '');

    if (graphWindowPreference === null) { // First visit to mempool.space
      if (window.location.pathname.includes('graphs') && key === 'graphWindowPreference' ||
        window.location.pathname.includes('pools') && key === 'miningWindowPreference'
      ) {
        this.setValue(key, fragment ? fragment : defaultValue);
      } else {
        this.setValue(key, defaultValue);
      }
    } else if (window.location.pathname.includes('graphs') && key === 'graphWindowPreference' ||
      window.location.pathname.includes('pools') && key === 'miningWindowPreference'
    ) {
      // Visit a different graphs#fragment from last visit
      if (fragment !== null && graphWindowPreference !== fragment) {
        this.setValue(key, fragment);
      }
    }
  }

  getValue(key: string): string {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.log(e);
      return '';
    }
  }

  setValue(key: string, value: any): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.log(e);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.log(e);
    }
  }

  getAuth(): any | null {
    try {
      return JSON.parse(localStorage.getItem('auth'));
    } catch(e) {
      return null;
    }
  }
}
