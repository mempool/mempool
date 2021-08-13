import { Component } from '@angular/core';
import { Observable} from 'rxjs';
import { StateService } from '../../services/state.service';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
})
export class StartComponent {
  mempoolLoadingStatus$: Observable<number>;
  constructor(private stateService: StateService,) {}
  ngOnInit(): void {
  this.mempoolLoadingStatus$ = this.stateService.loadingIndicators$.pipe(
    map((indicators) => indicators.mempool !== undefined ? indicators.mempool : 100)
  );  
  }
}
