import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-nodes-ranking',
  templateUrl: './nodes-ranking.component.html',
  styleUrls: ['./nodes-ranking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesRanking implements OnInit {

  ngOnInit(): void {
    console.log('hi');
  }

}
