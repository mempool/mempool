import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { StateService } from '../services/state.service';

@Component({
  selector: 'app-fiat',
  templateUrl: './fiat.component.html',
  styleUrls: ['./fiat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiatComponent implements OnInit {
  conversions$: Observable<any>;

  @Input() value: number;
  @Input() digitsInfo = '1.2-2';

  constructor(private stateService: StateService) {}

  ngOnInit(): void {
    this.conversions$ = this.stateService.conversions$.asObservable();
  }
}
