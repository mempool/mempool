import { Injectable } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject } from 'rxjs';
import { Block, Transaction } from '../interfaces/electrs.interface';
import { MempoolBlock, MemPoolState } from '../interfaces/websocket.interface';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';

interface MarkBlockState {
  blockHeight?: number;
  mempoolBlockIndex?: number;
  txFeePerVSize?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  latestBlockHeight = 0;
  blocks$ = new ReplaySubject<Block>(8);
  conversions$ = new ReplaySubject<any>(1);
  mempoolStats$ = new ReplaySubject<MemPoolState>();
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  txConfirmed$ = new Subject<Block>();
  mempoolTransactions$ = new Subject<Transaction>();
  assetTransactions$ = new Subject<Transaction>();
  blockTransactions$ = new Subject<Transaction>();

  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewFiat$ = new BehaviorSubject<boolean>(false);
  connectionState$ = new BehaviorSubject<0 | 1 | 2>(2);

  markBlock$ = new Subject<MarkBlockState>();
}
