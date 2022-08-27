import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { combineLatest, startWith, Observable, BehaviorSubject } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { isMobile } from 'src/app/shared/common.utils';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-channels-list',
  templateUrl: './channels-list.component.html',
  styleUrls: ['./channels-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelsListComponent implements OnInit, OnChanges {
  @Input() publicKey: string;
  @Input() status$: Observable<string>;
  @Output() channelsStatusChangedEvent = new EventEmitter<string>();
  channels$: Observable<any>;

  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 10;
  itemsPerPage = 10;
  page = 1;
  channelsPage$ = new BehaviorSubject<number>(1);
  publicKeySize = 25;

  constructor(
    private lightningApiService: LightningApiService,
  ) { 
    if (isMobile()) {
      this.publicKeySize = 12;
    }
  }

  ngOnInit(): void {
    if (document.body.clientWidth < 670) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }
  }

  ngOnChanges(): void {
    this.channels$ = combineLatest([
      this.channelsPage$,
      this.status$.pipe(startWith('open'))
    ])
    .pipe(
      tap(([page, status]) => {
        this.page = page;
      }),
      switchMap(([page, status]) => {
        this.channelsStatusChangedEvent.emit(status);
        return this.lightningApiService.getChannelsByNodeId$(this.publicKey, (this.page - 1) * this.itemsPerPage, status);
      }),
      map((response) => {
        return {
          channels: response.body,
          totalItems: parseInt(response.headers.get('x-total-count'), 10)
        };
      }),
    );
  }

  pageChange(page: number): void {
    this.channelsPage$.next(page);
  }

}
