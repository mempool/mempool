import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-change',
  templateUrl: './change.component.html',
  styleUrls: ['./change.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeComponent implements OnChanges {
  @Input() current: number;
  @Input() previous: number;

  change: number;

  constructor() { }

  ngOnChanges(): void {
    this.change = (this.current - this.previous) / this.previous * 100;
  }

}
