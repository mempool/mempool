import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { forkJoin, Observable, of, share, zip } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { ElectrsApiService } from 'src/app/services/electrs-api.service';
import { SeoService } from 'src/app/services/seo.service';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-channel',
  templateUrl: './channel.component.html',
  styleUrls: ['./channel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelComponent implements OnInit {
  channel$: Observable<any>;
  channelGeo$: Observable<number[]>;
  transactions$: Observable<any>;
  error: any = null;

  constructor(
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
    private seoService: SeoService,
    private electrsApiService: ElectrsApiService,
  ) { }

  ngOnInit(): void {
    this.channel$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.error = null;
          this.seoService.setTitle(`Channel: ${params.get('short_id')}`);
          return this.lightningApiService.getChannel$(params.get('short_id'))
            .pipe(
              catchError((err) => {
                this.error = err;
                return of(null);
              })
            );
        }),
        shareReplay(),
      );

    this.channelGeo$ = this.channel$.pipe(
      map((data) => {
        if (!data.node_left.longitude || !data.node_left.latitude ||
          !data.node_right.longitude || !data.node_right.latitude) {
          return [];
        } else {
          return [
            data.node_left.public_key,
            data.node_left.alias,
            data.node_left.longitude, data.node_left.latitude,
            data.node_right.public_key,
            data.node_right.alias,
            data.node_right.longitude, data.node_right.latitude,
          ];
        }
      }),
    );

    this.transactions$ = this.channel$.pipe(
      switchMap((data) => {
        return zip([
          data.transaction_id ? this.electrsApiService.getTransaction$(data.transaction_id) : of(null),
          data.closing_transaction_id ? this.electrsApiService.getTransaction$(data.closing_transaction_id) : of(null),
        ]);
      }),
    );
  }

}
