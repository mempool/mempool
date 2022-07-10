import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-channels-statistics',
  templateUrl: './channels-statistics.component.html',
  styleUrls: ['./channels-statistics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelsStatisticsComponent implements OnInit {
  @Input() statistics$: Observable<any>;
  mode: string = 'avg';

  constructor() { }

  ngOnInit(): void {
  }

  switchMode(mode: 'avg' | 'med') {
    this.mode = mode;
  }
}
