import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { INodesStatistics } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-node-statistics',
  templateUrl: './node-statistics.component.html',
  styleUrls: ['./node-statistics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeStatisticsComponent implements OnInit {
  @Input() statistics$: Observable<INodesStatistics>;

  constructor() { }

  ngOnInit(): void {
  }

}
