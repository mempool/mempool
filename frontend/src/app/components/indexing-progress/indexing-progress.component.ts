import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-indexing-progress',
  templateUrl: './indexing-progress.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class IndexingProgressComponent implements OnInit {
  @Input() blocks: boolean = true;
  @Input() networkHashrate: boolean = true;
  @Input() poolsHashrate: boolean = true;

  constructor(
  ) {}

  ngOnInit() {
  }
}
