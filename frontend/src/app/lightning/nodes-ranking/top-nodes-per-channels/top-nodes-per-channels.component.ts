import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { map, Observable } from 'rxjs';
import { INodesRanking, ITopNodesPerChannels } from 'src/app/interfaces/node-api.interface';

@Component({
  selector: 'app-top-nodes-per-channels',
  templateUrl: './top-nodes-per-channels.component.html',
  styleUrls: ['./top-nodes-per-channels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNodesPerChannels implements OnInit {
  @Input() nodes$: Observable<INodesRanking>;
  @Input() widget: boolean = false;
  
  topNodesPerChannels$: Observable<ITopNodesPerChannels[]>;
  skeletonRows: number[] = [];

  ngOnInit(): void {
    for (let i = 1; i <= (this.widget ? 10 : 100); ++i) {
      this.skeletonRows.push(i);
    }

    this.topNodesPerChannels$ = this.nodes$.pipe(
      map((ranking) => {
        if (this.widget === true) {
          return ranking.topByChannels.slice(0, 10);
        } else {
          return ranking.topByChannels;
        }
      })
    )
  }

}
