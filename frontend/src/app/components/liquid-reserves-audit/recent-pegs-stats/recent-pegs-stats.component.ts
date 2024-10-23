import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { PegsVolume } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-recent-pegs-stats',
  templateUrl: './recent-pegs-stats.component.html',
  styleUrls: ['./recent-pegs-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentPegsStatsComponent implements OnInit {
  @Input() pegsVolume$: Observable<PegsVolume[]>;

  constructor() { }

  ngOnInit(): void {
  }

}
