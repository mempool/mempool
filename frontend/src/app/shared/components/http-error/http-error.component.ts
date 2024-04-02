import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-http-error',
  templateUrl: './http-error.component.html',
  styleUrls: ['./http-error.component.scss']
})
export class HttpErrorComponent {
  @Input() error: HttpErrorResponse | null;
}
