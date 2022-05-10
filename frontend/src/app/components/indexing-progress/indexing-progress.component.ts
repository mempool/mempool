import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-indexing-progress',
  templateUrl: './indexing-progress.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IndexingProgressComponent implements OnInit {
  constructor(
  ) {}

  ngOnInit() {
  }
}
