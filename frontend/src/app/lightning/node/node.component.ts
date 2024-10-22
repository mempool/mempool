import { ChangeDetectionStrategy, Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap, share } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { ApiService } from '@app/services/api.service';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { GeolocationData } from '@app/shared/components/geolocation/geolocation.component';
import { ILiquidityAd, parseLiquidityAdHex } from '@app/lightning/node/liquidity-ad';
import { haversineDistance, kmToMiles } from '@app/shared/common.utils';
import { ServicesApiServices } from '@app/services/services-api.service';

interface CustomRecord {
  type: string;
  payload: string;
}

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeComponent implements OnInit {
  node$: Observable<any>;
  statistics$: Observable<any>;
  publicKey$: Observable<string>;
  selectedSocketIndex = 0;
  qrCodeVisible = false;
  channelsListStatus: string;
  error: Error;
  publicKey: string;
  channelListLoading = false;
  clearnetSocketCount = 0;
  torSocketCount = 0;
  hasDetails = false;
  showDetails = false;
  liquidityAd: ILiquidityAd;
  tlvRecords: CustomRecord[];
  avgChannelDistance$: Observable<number | null>;
  showFeatures = false;
  kmToMiles = kmToMiles;

  constructor(
    private apiService: ApiService,
    private servicesApiService: ServicesApiServices,
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
    private seoService: SeoService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.node$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.publicKey = params.get('public_key');
          this.tlvRecords = [];
          this.liquidityAd = null;
          return this.lightningApiService.getNode$(params.get('public_key'));
        }),
        map((node) => {
          this.seoService.setTitle($localize`Node: ${node.alias}`);
          this.seoService.setDescription($localize`:@@meta.description.lightning.node:Overview for the Lightning network node named ${node.alias}. See channels, capacity, location, fee stats, and more.`);
          this.clearnetSocketCount = 0;
          this.torSocketCount = 0;

          const socketsObject = [];
          for (const socket of node.sockets.split(',')) {
            if (socket === '') {
              continue;
            }
            let label = '';
            if (socket.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)) {
              label = 'IPv4';
              this.clearnetSocketCount++;
            } else if (socket.indexOf('[') > -1) {
              label = 'IPv6';
              this.clearnetSocketCount++;
            } else if (socket.indexOf('onion') > -1) {
              label = 'Tor';
              this.torSocketCount++;
            }
            socketsObject.push({
              label: label,
              socket: node.public_key + '@' + socket,
            });
          }
          node.socketsObject = socketsObject;
          node.avgCapacity = node.capacity / Math.max(1, node.active_channel_count);

          if (!node?.country && !node?.city &&
            !node?.subdivision && !node?.iso) {
              node.geolocation = null;
          } else {
            node.geolocation = <GeolocationData>{
              country: node.country?.en,
              city: node.city?.en,
              subdivision: node.subdivision?.en,
              iso: node.iso_code,
            };
          }

          return node;
        }),
        tap((node) => {
          this.hasDetails = Object.keys(node.custom_records).length > 0;
          for (const [type, payload] of Object.entries(node.custom_records)) {
            if (typeof payload !== 'string') {
              break;
            }

            let parsed = false;
            if (type === '1') {
              const ad = parseLiquidityAdHex(payload);
              if (ad) {
                parsed = true;
                this.liquidityAd = ad;
              }
            }
            if (!parsed) {
              this.tlvRecords.push({ type, payload });
            }
          }
        }),
        catchError(err => {
          this.error = err;
          this.seoService.logSoft404();
          return [{
            alias: this.publicKey,
            public_key: this.publicKey,
          }];
        })
      );

    this.avgChannelDistance$ = this.activatedRoute.paramMap
    .pipe(
      switchMap((params: ParamMap) => {
        return this.apiService.getChannelsGeo$(params.get('public_key'), 'nodepage');
      }),
      map((channelsGeo) => {
        if (channelsGeo?.length) {
          const totalDistance = channelsGeo.reduce((sum, chan) => {
            return sum + haversineDistance(chan[3], chan[2], chan[7], chan[6]);
          }, 0);
          return totalDistance / channelsGeo.length;
        } else {
          return null;
        }
      }),
      catchError(() => {
        return null;
      })
    ) as Observable<number | null>;
  }

  toggleShowDetails(): void {
    this.showDetails = !this.showDetails;
  }

  changeSocket(index: number) {
    this.selectedSocketIndex = index;
  }

  onChannelsListStatusChanged(e) {
    this.channelsListStatus = e;
  }

  onLoadingEvent(e) {
    this.channelListLoading = e;
  }

  toggleFeatures() {
    this.showFeatures = !this.showFeatures;
    return false;
  }
}
