import { Pipe, PipeTransform } from '@angular/core';
import { StateService } from 'src/app/services/state.service';

@Pipe({
  name: 'relativeUrl',
})
export class RelativeUrlPipe implements PipeTransform {
  constructor(private stateService: StateService) {}

  transform(value: string): string {
    return (this.stateService.network ? '/' + this.stateService.network : '') + value;
  }
}
