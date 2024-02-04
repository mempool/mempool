import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
@Component({
  selector: 'app-recent-pegs-stats',
  templateUrl: './recent-pegs-stats.component.html',
  styleUrls: ['./recent-pegs-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentPegsStatsComponent implements OnInit {
  constructor() { }

  ngOnInit(): void {
    
  }

}
