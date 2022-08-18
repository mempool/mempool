import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-nodes-ranking',
  templateUrl: './nodes-ranking.component.html',
  styleUrls: ['./nodes-ranking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesRanking implements OnInit {
  type: string;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.type = data.type;
    });
  }
}
