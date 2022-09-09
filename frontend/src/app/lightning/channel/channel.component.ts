import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable, of, zip } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { IChannel } from 'src/app/interfaces/node-api.interface';
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
          return this.lightningApiService.getChannel$(params.get('short_id'))
            .pipe(
              tap((value) => {
                this.seoService.setTitle(`Channel: ${value.short_id}`);
              }),
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
      switchMap((channel: IChannel) => {
        return zip([
          channel.transaction_id ? this.electrsApiService.getTransaction$(channel.transaction_id) : of(null),
          channel.closing_transaction_id ? this.electrsApiService.getTransaction$(channel.closing_transaction_id).pipe(
            map((tx) => {
              tx._channels = { inputs: {0: channel}, outputs: {}};
              return tx;
            })
          ) : of(null),
        ]);
      }),
    );
  }

}
