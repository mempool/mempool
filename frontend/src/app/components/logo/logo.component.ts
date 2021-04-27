import { Component, Input } from '@angular/core';
import { Env, StateService } from '../../services/state.service';

@Component({
  selector: 'app-logo',
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.scss'],
})

export class LogoComponent {
  
  @Input() sizeBig: boolean = false;

  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private stateService: StateService,    
  ) {}
}