import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.component.html',
  styleUrls: ['./loading-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingIndicatorComponent implements OnInit {
  @Input() name: string;
  @Input() label: string;

  public indexingProgress$: Observable<number>;

  constructor(
    private stateService: StateService,
    private websocketService: WebsocketService
  ) {}

  ngOnInit() {
    this.indexingProgress$ = this.stateService.loadingIndicators$
      .pipe(
        map((indicators) => indicators[this.name] ?? -1)
      );
  }
}
