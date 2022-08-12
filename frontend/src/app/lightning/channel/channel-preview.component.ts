import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { OpenGraphService } from 'src/app/services/opengraph.service';
import { LightningApiService } from '../lightning-api.service';

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
          this.openGraphService.waitFor('channel-map');
          this.openGraphService.waitFor('channel-data');
          this.error = null;
          this.seoService.setTitle(`Channel: ${params.get('short_id')}`);
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
                this.openGraphService.waitOver('channel-data');
              }),
              catchError((err) => {
                this.error = err;
                this.openGraphService.fail('channel-map');
                this.openGraphService.fail('channel-data');
                return of(null);
              })
            );
        })
      );
  }

  onMapReady() {
    this.openGraphService.waitOver('channel-map');
  }
}
