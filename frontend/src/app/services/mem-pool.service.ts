import { Injectable } from '@angular/core';
import { Subject, ReplaySubject } from 'rxjs';
import { IMempoolInfo } from '../blockchain/interfaces';

export interface MemPoolState {
  memPoolInfo: IMempoolInfo;
  txPerSecond: number;
  vBytesPerSecond: number;
}

@Injectable({
  providedIn: 'root'
})
export class MemPoolService {
  loaderSubject = new Subject<MemPoolState>();
  isOffline = new Subject<boolean>();
  txIdSearch = new Subject<string>();
  conversions = new ReplaySubject<any>();
  mempoolWeight = new Subject<number>();
}
