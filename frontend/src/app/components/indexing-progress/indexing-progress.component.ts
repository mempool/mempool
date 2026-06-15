import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-indexing-progress',
  templateUrl: './indexing-progress.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class IndexingProgressComponent implements OnInit {
  @Input() showBlocks: boolean = true;
  @Input() showNetworkHashrate: boolean = true;
  @Input() showPoolsHashrate: boolean = true;

  constructor(
  ) {}

  ngOnInit() {
  }
}
