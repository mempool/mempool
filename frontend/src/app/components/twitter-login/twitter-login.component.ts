import { Component, EventEmitter, Input, Output } from '@angular/core';
@Component({
  selector: 'app-twitter-login',
  templateUrl: './twitter-login.component.html',
})
export class TwitterLogin {
  @Input() width: string | null = null;
  @Input() customClass: string | null = null;
  @Input() buttonString: string= 'unset';
  @Input() redirectTo: string | null = null;
  @Output() clicked = new EventEmitter<boolean>();
  @Input() disabled: boolean = false;

  constructor() {}

  twitterLogin() {
    this.clicked.emit(true);
    if (this.redirectTo) {
      location.replace(`/api/v1/services/auth/login/twitter?redirectTo=${encodeURIComponent(this.redirectTo)}`);
    } else {
      location.replace(`/api/v1/services/auth/login/twitter?redirectTo=${location.href}`);
    }
    return false;
  }
}
