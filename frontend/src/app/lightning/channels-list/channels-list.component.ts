import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-channels-list',
  templateUrl: './channels-list.component.html',
  styleUrls: ['./channels-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelsListComponent implements OnChanges {
  @Input() publicKey: string;
  channels$: Observable<any[]>;

  constructor(
    private lightningApiService: LightningApiService,
  ) { }

  ngOnChanges(): void {
    this.channels$ = this.lightningApiService.getChannelsByNodeId$(this.publicKey);
  }

}
