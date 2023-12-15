import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { StateService } from './state.service';
import { StorageService } from './storage.service';
import { MenuGroup } from '../interfaces/services.interface';
import { Observable, of, ReplaySubject, tap, catchError, share } from 'rxjs';
import { IBackendInfo } from '../interfaces/websocket.interface';
import { Acceleration, AccelerationHistoryParams } from '../interfaces/node-api.interface';

export type ProductType = 'enterprise' | 'community' | 'mining_pool' | 'custom';
export interface IUser {
  username: string;
  email: string | null;
  passwordIsSet: boolean;
  snsId: string;
  type: ProductType;
  subscription_tag: string;
  status: 'pending' | 'verified' | 'disabled';
  features: string | null;
  fullName: string | null;
  countryCode: string | null;
  imageMd5: string;
  ogRank: number | null;
}

// Todo - move to config.json
const SERVICES_API_PREFIX = `/api/v1/services`;

@Injectable({
  providedIn: 'root'
})
export class ServicesApiServices {
  private apiBaseUrl: string; // base URL is protocol, hostname, and port
  private apiBasePath: string; // network path is /testnet, etc. or '' for mainnet

  userSubject$ = new ReplaySubject<IUser | null>(1);

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
    private storageService: StorageService
  ) {
    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.apiBasePath = ''; // assume mainnet by default
    this.stateService.networkChanged$.subscribe((network) => {
      if (network === 'bisq' && !this.stateService.env.BISQ_SEPARATE_BACKEND) {
        network = '';
      }
      this.apiBasePath = network ? '/' + network : '';
    });

    if (this.stateService.env.GIT_COMMIT_HASH_MEMPOOL_SPACE) {
      this.getServicesBackendInfo$().subscribe(version => {
        this.stateService.servicesBackendInfo$.next(version);
      })
    }

    this.getUserInfo$().subscribe();
  }

  /**
   * Do not call directly, userSubject$ instead
   */
  private getUserInfo$() {
    return this.getUserInfoApi$().pipe(
      tap((user) => {
        this.userSubject$.next(user);
      }),
      catchError((e) => {
        if (e.error === 'User does not exists') {
          this.userSubject$.next(null);
          this.logout$().subscribe();
          return of(null);
        }
        this.userSubject$.next(null);
        return of(null);
      }),
      share(),
    )
  }

  /**
   * Do not call directly, userSubject$ instead
   */
  private getUserInfoApi$(): Observable<any> {
    const auth = this.storageService.getAuth();
    if (!auth) {
      return of(null);
    }

    return this.httpClient.get<any>(`${SERVICES_API_PREFIX}/account`);
  }

  getNodeOwner$(publicKey: string): Observable<any> {
    let params = new HttpParams()
      .set('node_public_key', publicKey);
    return this.httpClient.get<any>(`${SERVICES_API_PREFIX}/lightning/claim/current`, { params, observe: 'response' });
  }

  getUserMenuGroups$(): Observable<MenuGroup[]> {
    const auth = this.storageService.getAuth();
    if (!auth) {
      return of(null);
    }

    return this.httpClient.get<MenuGroup[]>(`${SERVICES_API_PREFIX}/account/menu`);
  }

  logout$(): Observable<any> {
    const auth = this.storageService.getAuth();
    if (!auth) {
      return of(null);
    }

    localStorage.removeItem('auth');
    return this.httpClient.post(`${SERVICES_API_PREFIX}/auth/logout`, {});
  }

  getServicesBackendInfo$(): Observable<IBackendInfo> {
    return this.httpClient.get<IBackendInfo>(`${SERVICES_API_PREFIX}/version`);
  }

  estimate$(txInput: string) {
    return this.httpClient.post<any>(`${SERVICES_API_PREFIX}/accelerator/estimate`, { txInput: txInput }, { observe: 'response' });
  }

  accelerate$(txInput: string, userBid: number) {
    return this.httpClient.post<any>(`${SERVICES_API_PREFIX}/accelerator/accelerate`, { txInput: txInput, userBid: userBid });
  }

  getAccelerations$(): Observable<Acceleration[]> {
    return this.httpClient.get<Acceleration[]>(`${SERVICES_API_PREFIX}/accelerator/accelerations`);
  }

  getAccelerationHistory$(params: AccelerationHistoryParams): Observable<Acceleration[]> {
    return this.httpClient.get<Acceleration[]>(`${SERVICES_API_PREFIX}/accelerator/accelerations/history`, { params: { ...params } });
  }
}
