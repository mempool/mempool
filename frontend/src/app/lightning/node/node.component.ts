import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { getFlagEmoji } from 'src/app/shared/graphs.utils';
import { LightningApiService } from '../lightning-api.service';

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
  channelsListMode = 'list';
  channelsListStatus: string;
  error: Error;
  publicKey: string;

  constructor(
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.node$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.publicKey = params.get('public_key');
          return this.lightningApiService.getNode$(params.get('public_key'));
        }),
        map((node) => {
          this.seoService.setTitle(`Node: ${node.alias}`);

          const socketsObject = [];
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
          }
          node.socketsObject = socketsObject;
          return node;
        }),
        catchError(err => {
          this.error = err;
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

  channelsListModeChange(toggle) {
    if (toggle === true) {
      this.channelsListMode = 'map';
    } else {
      this.channelsListMode = 'list';
    }
  }

  onChannelsListStatusChanged(e) {
    this.channelsListStatus = e;
  }
}
