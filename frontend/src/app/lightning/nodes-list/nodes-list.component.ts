import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-nodes-list',
  templateUrl: './nodes-list.component.html',
  styleUrls: ['./nodes-list.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesListComponent implements OnInit {
  @Input() nodes$: Observable<any>;
  @Input() show: string;

  constructor() { }

  ngOnInit(): void {
  }

}
