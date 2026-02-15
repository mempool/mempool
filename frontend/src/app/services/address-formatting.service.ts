import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

export type FormattingMode = 'off' | 'color' | 'spacing' | 'copy';

@Injectable({
  providedIn: 'root'
})
export class AddressFormattingService {
  private readonly STORAGE_KEY = 'address-formatting-mode';
  
  private modeSubject = new BehaviorSubject<FormattingMode>(this.getInitialState());
  mode$ = this.modeSubject.asObservable();

  constructor(private storageService: StorageService) {}

  get mode(): FormattingMode {
    return this.modeSubject.value;
  }

  setMode(mode: FormattingMode) {
    this.modeSubject.next(mode);
    this.storageService.setValue(this.STORAGE_KEY, mode);
  }

  get useColors(): boolean {
    return this.mode !== 'off';
  }

  get useSpacing(): boolean {
    return this.mode === 'spacing' || this.mode === 'copy';
  }

  get showCopyButton(): boolean {
    return this.mode === 'copy';
  }

  private getInitialState(): FormattingMode {
    const saved = this.storageService.getValue(this.STORAGE_KEY);
    if (saved === 'color' || saved === 'spacing' || saved === 'copy') {
      return saved as FormattingMode;
    }
    return 'off';
  }
}