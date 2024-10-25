import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { ServicesApiServices } from '@app/services/services-api.service';

export interface IAuth {
  token: string;
  user: {
    userId: number;
    username: string;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthServiceMempool {
  private auth$: ReplaySubject<IAuth | null> = new ReplaySubject(1);

  constructor(
    private servicesApiService: ServicesApiServices,
    private router: Router,
  ) {
    const localStorageAuth = localStorage.getItem('auth');
    if (!localStorageAuth || localStorageAuth.length === 0) {
      this.setAuth(null);
    } else {
      try {
        this.setAuth(JSON.parse(localStorageAuth));
      } catch (e) {
        console.error(`Unable to parse 'auth' from localStorage`, e);
        localStorage.removeItem('auth');
        this.setAuth(null);
      }
    }
  }

  refreshAuth$(): Observable<IAuth | null> {
    return this.servicesApiService.getJWT$()
      .pipe(
        tap((user) => {
          this.setAuth(user);
        }),
        map((user) => {
          return user;
        }),
        catchError(() => {
          this.setAuth(null);
          return of(null);
        }),
      );
  }

  logout() {
    this.setAuth(null);
  }

  setAuth(auth: any) {
    if (!auth) {
      localStorage.removeItem('auth');
    } else {
      localStorage.setItem('auth', JSON.stringify(auth));
    }
    this.auth$.next(auth);
  }

  getAuth$(): Observable<IAuth | null> {
    if (!localStorage.getItem('auth')) {
      return this.refreshAuth$().pipe(
        switchMap(() => this.auth$.asObservable())
      );
    }
    return this.auth$.asObservable();
  }
}
