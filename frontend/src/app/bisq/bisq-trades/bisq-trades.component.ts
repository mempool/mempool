import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-bisq-trades',
  templateUrl: './bisq-trades.component.html',
  styleUrls: ['./bisq-trades.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BisqTradesComponent implements OnChanges {
  @Input() trades$: Observable<any>;
  @Input() market: any;
  @Input() view: 'all' | 'small' = 'all';

  loadingColumns = [1, 2, 3, 4];

  ngOnChanges() {
    if (this.view === 'small') {
      this.loadingColumns = [1, 2, 3];
    }
  }
}
