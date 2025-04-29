import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'httpErrorMsg',
    standalone: false
})
export class HttpErrorPipe implements PipeTransform {
  transform(e: HttpErrorResponse | null): string {
    return e ? `${e.status} ${e.statusText}: ${e.error}` : '';
  }
}
