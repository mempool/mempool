import { Pipe, PipeTransform } from '@angular/core';
import { StateService } from '../../../services/state.service';

@Pipe({
  name: 'relativeUrl'
})
export class RelativeUrlPipe implements PipeTransform {

  constructor(
    private stateService: StateService,
  ) { }

  transform(value: string): string {
    let network = this.stateService.network;
    if (this.stateService.env.BASE_MODULE === 'liquid' && network === 'liquidtestnet') {
      network = 'testnet';
    } else if (this.stateService.env.BASE_MODULE !== 'mempool') {
      network = '';
    }
    return (network ? '/' + network : '') + value;
  }

}
