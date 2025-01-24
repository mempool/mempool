import { Component, EventEmitter, Input, Output } from '@angular/core';
@Component({
  selector: 'app-github-login',
  templateUrl: './github-login.component.html',
})
export class GithubLogin {
  @Input() width: string | null = null;
  @Input() customClass: string | null = null;
  @Input() buttonString: string= 'unset';
  @Input() redirectTo: string | null = null;
  @Output() clicked = new EventEmitter<boolean>();
  @Input() disabled: boolean = false;

  constructor() {}

  githubLogin() {
    this.clicked.emit(true);
    if (this.redirectTo) {
      location.replace(`/api/v1/services/auth/login/github?redirectTo=${encodeURIComponent(this.redirectTo)}`);
    } else {
      location.replace(`/api/v1/services/auth/login/github?redirectTo=${location.href}`);
    }
    return false;
  }
}
