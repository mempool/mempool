import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-node-owner',
  templateUrl: './node-owner.component.html',
  styleUrls: ['./node-owner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeOwnerComponent{
  @Input() publicKey: string = '';
  @Input() alias: string = '';
  @Input() nodeOwner$: Observable<any>;

  constructor(
    public stateService: StateService
  ) {
  }
}
