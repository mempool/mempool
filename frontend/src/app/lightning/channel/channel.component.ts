import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
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
  error: any = null;
  channelGeo: number[] = [];

  constructor(
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.channel$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
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
              }),
              catchError((err) => {
                this.error = err;
                return of(null);
              })
            );
        })
      );
  }

}
