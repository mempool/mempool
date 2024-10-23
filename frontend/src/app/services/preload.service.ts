import { Injectable } from '@angular/core';
import { ElectrsApiService } from '../services/electrs-api.service';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { ApiService } from '@app/services/api.service';

@Injectable({
  providedIn: 'root'
})
export class PreloadService {
  block$ = new Subject<string>;
  blockAudit$ = new Subject<string>;
  debounceTime = 250;

  constructor(
    private electrsApiService: ElectrsApiService,
    private apiService: ApiService,
  ) {
    this.block$
      .pipe(
        debounceTime(this.debounceTime),
        switchMap((blockHash) => this.electrsApiService.getBlockTransactions$(blockHash))
      )
      .subscribe();

    this.blockAudit$
      .pipe(
        debounceTime(this.debounceTime),
        switchMap((blockHash) => this.apiService.getBlockAudit$(blockHash))
      )
      .subscribe();
  }

}
