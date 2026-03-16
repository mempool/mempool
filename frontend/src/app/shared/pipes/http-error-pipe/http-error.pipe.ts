import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'httpErrorMsg',
  standalone: false,
})
export class HttpErrorPipe implements PipeTransform {
  transform(e: HttpErrorResponse | null): string {
    const errorMsg = typeof e.error === 'string' ? e.error : e.error?.error ?? '';
    return e ? `${e.status} ${e.statusText}: ${errorMsg}` : '';
  }
}
