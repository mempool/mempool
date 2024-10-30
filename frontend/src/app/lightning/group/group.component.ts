import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { map, Observable, share } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { GeolocationData } from '@app/shared/components/geolocation/geolocation.component';
import { LightningApiService } from '@app/lightning/lightning-api.service';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupComponent implements OnInit {
  nodes$: Observable<any>;
  isp: {name: string, id: number};

  skeletonLines: number[] = [];
  selectedSocketIndex = 0;
  qrCodeVisible = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  socketToggleForm: UntypedFormGroup;

  constructor(
    private lightningApiService: LightningApiService,
    private seoService: SeoService,
    private formBuilder: UntypedFormBuilder,
  ) {
    for (let i = 0; i < 20; ++i) {
      this.skeletonLines.push(i);
    }
  }

  ngOnInit(): void {
    this.socketToggleForm = this.formBuilder.group({
      socket: [this.selectedSocketIndex],
    });

    this.socketToggleForm.get('socket').valueChanges.subscribe((val) => {
      this.selectedSocketIndex = val;
    });

    this.seoService.setTitle(`Mempool.space Lightning Nodes`);
    this.seoService.setDescription(`See all Lightning nodes run by mempool.space -- these are the nodes that provide the data on the mempool.space Lightning dashboard.`);

    this.nodes$ = this.lightningApiService.getNodeGroup$('mempool.space')
      .pipe(
        map((nodes) => {
          for (const node of nodes) {
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
              socketsObject.push({
                label: label,
                socket: node.public_key + '@' + socket,
              });
            }
            // @ts-ignore
            node.socketsObject = socketsObject;

            if (!node?.country && !node?.city &&
              !node?.subdivision) {
                // @ts-ignore
                node.geolocation = null;
            } else {
              // @ts-ignore
              node.geolocation = <GeolocationData>{
                country: node.country?.en,
                city: node.city?.en,
                subdivision: node.subdivision?.en,
                iso: node.iso_code,
              };
            }
          }

          nodes.map((node) => {
            node.channels = node.opened_channel_count;
            return node;
          });

          const sumLiquidity = nodes.reduce((partialSum, a) => partialSum + parseInt(a.capacity, 10), 0);
          const sumChannels = nodes.reduce((partialSum, a) => partialSum + a.opened_channel_count, 0);
          
          return {
            nodes: nodes,
            sumLiquidity: sumLiquidity,
            sumChannels: sumChannels,
          };
        }),
        share()
      );
  }

  trackByPublicKey(index: number, node: any): string {
    return node.public_key;
  }

  changeSocket(index: number) {
    this.selectedSocketIndex = index;
  }

}
