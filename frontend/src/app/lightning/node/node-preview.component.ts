import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { getFlagEmoji } from '@app/shared/common.utils';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { isMobile } from '@app/shared/common.utils';

@Component({
  selector: 'app-node-preview',
  templateUrl: './node-preview.component.html',
  styleUrls: ['./node-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodePreviewComponent implements OnInit {
  node$: Observable<any>;
  statistics$: Observable<any>;
  publicKey$: Observable<string>;
  selectedSocketIndex = 0;
  qrCodeVisible = false;
  channelsListStatus: string;
  error: Error;
  publicKey: string;
  socketTypes: string[];

  publicKeySize = 99;

  constructor(
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
    private seoService: SeoService,
    private openGraphService: OpenGraphService,
  ) {
    if (isMobile()) {
      this.publicKeySize = 12;
    }
  }

  ngOnInit(): void {
    this.node$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.publicKey = params.get('public_key');
          this.openGraphService.waitFor('node-map-' + this.publicKey);
          this.openGraphService.waitFor('node-data-' + this.publicKey);
          return this.lightningApiService.getNode$(params.get('public_key'));
        }),
        map((node) => {
          this.seoService.setTitle(`Node: ${node.alias}`);
          this.seoService.setDescription($localize`:@@meta.description.lightning.node:Overview for the Lightning network node named ${node.alias}. See channels, capacity, location, fee stats, and more.`);

          const socketsObject = [];
          const socketTypesMap = {};
          for (const socket of node.sockets.split(',')) {
            if (socket === '') {
              continue;
            }
            let label = '';
            if (socket.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)) {
              label = 'IPv4';
            } else if (socket.indexOf('[') > -1) {
              label = 'IPv6';
            } else if (socket.indexOf('onion') > -1) {
              label = 'Tor';
            }
            node.flag = getFlagEmoji(node.iso_code);
            socketsObject.push({
              label: label,
              socket: node.public_key + '@' + socket,
            });
            socketTypesMap[label] = true
          }
          node.socketsObject = socketsObject;
          this.socketTypes = Object.keys(socketTypesMap);
          node.avgCapacity = node.capacity / Math.max(1, node.active_channel_count);

          this.openGraphService.waitOver('node-data-' + this.publicKey);

          return node;
        }),
        catchError(err => {
          this.error = err;
          this.seoService.logSoft404();
          this.openGraphService.fail('node-map-' + this.publicKey);
          this.openGraphService.fail('node-data-' + this.publicKey);
          return [{
            alias: this.publicKey,
            public_key: this.publicKey,
          }];
        })
      );
  }

  changeSocket(index: number) {
    this.selectedSocketIndex = index;
  }

  onChannelsListStatusChanged(e) {
    this.channelsListStatus = e;
  }

  onMapReady() {
    this.openGraphService.waitOver('node-map-' + this.publicKey);
  }
}
