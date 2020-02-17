import { Injectable } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject } from 'rxjs';
import { Block } from '../interfaces/electrs.interface';
import { MempoolBlock, MemPoolState } from '../interfaces/websocket.interface';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  latestBlockHeight = 0;
  blocks$ = new ReplaySubject<Block>(8);
  conversions$ = new ReplaySubject<any>(1);
  mempoolStats$ = new ReplaySubject<MemPoolState>();
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  txConfirmed = new Subject<Block>();
  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewFiat$ = new BehaviorSubject<boolean>(false);
  isOffline$ = new BehaviorSubject<boolean>(false);
}
