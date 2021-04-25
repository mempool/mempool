import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-bisq-trades',
  templateUrl: './bisq-trades.component.html',
  styleUrls: ['./bisq-trades.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BisqTradesComponent {
  @Input() trades$: Observable<any>;
  @Input() market: any;
}
