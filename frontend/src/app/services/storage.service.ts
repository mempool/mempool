import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  getValue(key: string): string {
    try {
      return localStorage.getItem(key);
    } catch (e) { }
  }

  setValue(key: string, value: any): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) { }
  }
}
