import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { LightningApiService } from '@app/lightning/lightning-api.service';

@Component({
  selector: 'app-channel-preview',
  templateUrl: './channel-preview.component.html',
  styleUrls: ['./channel-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelPreviewComponent implements OnInit {
  channel$: Observable<any>;
  error: any = null;
  channelGeo: number[] = [];
  shortId: string;

  constructor(
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
    private seoService: SeoService,
    private openGraphService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.channel$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.shortId = params.get('short_id') || '';
          this.openGraphService.waitFor('channel-map-' + this.shortId);
          this.openGraphService.waitFor('channel-data-' + this.shortId);
          this.error = null;
          this.seoService.setTitle(`Channel: ${params.get('short_id')}`);
          this.seoService.setDescription($localize`:@@meta.description.lightning.channel:Overview for Lightning channel ${params.get('short_id')}. See channel capacity, the Lightning nodes involved, related on-chain transactions, and more.`);
          return this.lightningApiService.getChannel$(params.get('short_id'))
            .pipe(
              tap((data) => {
                if (!data.node_left.longitude || !data.node_left.latitude ||
                  !data.node_right.longitude || !data.node_right.latitude) {
                  this.channelGeo = [];
                } else {
                  this.channelGeo = [
                    data.node_left.public_key,
                    data.node_left.alias,
                    data.node_left.longitude, data.node_left.latitude,
                    data.node_right.public_key,
                    data.node_right.alias,
                    data.node_right.longitude, data.node_right.latitude,
                  ];
                }
                this.openGraphService.waitOver('channel-data-' + this.shortId);
              }),
              catchError((err) => {
                this.error = err;
                this.seoService.logSoft404();
                this.openGraphService.fail('channel-map-' + this.shortId);
                this.openGraphService.fail('channel-data-' + this.shortId);
                return of(null);
              })
            );
        })
      );
  }

  onMapReady() {
    this.openGraphService.waitOver('channel-map-' + this.shortId);
  }
}
