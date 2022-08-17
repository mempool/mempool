import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { map, Observable } from 'rxjs';
import { INodesRanking, ITopNodesPerCapacity } from 'src/app/interfaces/node-api.interface';

@Component({
  selector: 'app-top-nodes-per-capacity',
  templateUrl: './top-nodes-per-capacity.component.html',
  styleUrls: ['./top-nodes-per-capacity.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNodesPerCapacity implements OnInit {
  @Input() nodes$: Observable<INodesRanking>;
  @Input() widget: boolean = false;
  
  topNodesPerCapacity$: Observable<ITopNodesPerCapacity[]>;
  skeletonRows: number[] = [];

  ngOnInit(): void {
    for (let i = 1; i <= (this.widget ? 10 : 100); ++i) {
      this.skeletonRows.push(i);
    }

    this.topNodesPerCapacity$ = this.nodes$.pipe(
      map((ranking) => {
        if (this.widget === true) {
          return ranking.topByCapacity.slice(0, 10);
        } else {
          return ranking.topByCapacity;
        }
      })
    )
  }

}
