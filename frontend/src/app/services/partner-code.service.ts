import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, shareReplay } from 'rxjs/operators';
import { EnterpriseService } from '@app/services/enterprise.service';
import { StorageService } from '@app/services/storage.service';

@Injectable({
  providedIn: 'root'
})
export class PartnerCodeService {
  private readonly storedPartnerCode$: BehaviorSubject<string | undefined>;

  readonly partnerCode$: Observable<string | undefined>;

  constructor(
    private enterpriseService: EnterpriseService,
    private storageService: StorageService,
  ) {
    // holds the most recent unused one-off code
    const storedPartnerCode = this.storageService.getValue('partnerCode');
    const isEnterprise = !!this.enterpriseService.getSubdomain();
    this.storedPartnerCode$ = new BehaviorSubject<string | undefined>(storedPartnerCode || undefined);

    const enterprisePartnerCode$ = this.enterpriseService.info$.pipe(
      filter((info: object | null) => !isEnterprise || info !== null),
      map((info: object | null) => (info as { name?: string } | null)?.name || undefined),
    );

    // enterprise partner code takes precedence, and remains applicable for all requests on this instance
    // one-off code applies to the first successful request after being set, iff no enterprise code is present
    this.partnerCode$ = combineLatest([
      enterprisePartnerCode$,
      this.storedPartnerCode$,
    ]).pipe(
      map(([enterpriseCode, storedCode]) => enterpriseCode || storedCode),
      distinctUntilChanged(),
      shareReplay(1),
    );
  }

  // set a one-off partner code from a URL fragment
  setFragmentPartnerCode(partnerCode: string): void {
    this.storageService.setValue('partnerCode', partnerCode);
    this.storedPartnerCode$.next(partnerCode);
  }

  // clear any one-off code after successful use
  clearStoredPartnerCode(): void {
    this.storageService.removeItem('partnerCode');
    this.storedPartnerCode$.next(undefined);
  }
}
