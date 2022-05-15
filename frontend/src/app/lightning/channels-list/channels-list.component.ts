import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { BehaviorSubject, combineLatest, merge, Observable, of } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-channels-list',
  templateUrl: './channels-list.component.html',
  styleUrls: ['./channels-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelsListComponent implements OnInit, OnChanges {
  @Input() publicKey: string;
  channels$: Observable<any>;

  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 10;
  itemsPerPage = 25;
  page = 1;
  channelsPage$ = new BehaviorSubject<number>(1);
  channelStatusForm: FormGroup;
  defaultStatus = 'open';

  constructor(
    private lightningApiService: LightningApiService,
    private formBuilder: FormBuilder,
  ) { 
    this.channelStatusForm = this.formBuilder.group({
      status: [this.defaultStatus],
    });
  }

  ngOnInit() {
    if (document.body.clientWidth < 670) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }
  }

  ngOnChanges(): void {
    this.channels$ = combineLatest([
      this.channelsPage$,
      this.channelStatusForm.get('status').valueChanges.pipe(startWith(this.defaultStatus))
    ])
    .pipe(
      switchMap(([page, status]) =>this.lightningApiService.getChannelsByNodeId$(this.publicKey, (page -1) * this.itemsPerPage, status)),
      map((response) => {
        return {
          channels: response.body,
          totalItems: parseInt(response.headers.get('x-total-count'), 10)
        };
      }),
    );
  }

  pageChange(page: number) {
    this.channelsPage$.next(page);
  }

}
