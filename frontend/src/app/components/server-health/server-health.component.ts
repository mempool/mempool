import { Component, OnInit, ChangeDetectionStrategy, SecurityContext, OnDestroy } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { Observable, Subject, map, tap } from 'rxjs';
import { StateService } from '../../services/state.service';
import { HealthCheckHost } from '../../interfaces/websocket.interface';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-server-health',
  templateUrl: './server-health.component.html',
  styleUrls: ['./server-health.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerHealthComponent implements OnInit, OnDestroy {
  hosts$: Observable<HealthCheckHost[]>;
  tip$: Subject<number>;
  hosts: HealthCheckHost[] = [];

  constructor(
    private websocketService: WebsocketService,
    private stateService: StateService,
    public sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.hosts$ = this.stateService.serverHealth$.pipe(
      map((hosts) => {
        const subpath = window.location.pathname.slice(0, -6);
        for (const host of hosts) {
          let statusUrl = '';
          let linkHost = '';
          if (host.socket) {
            statusUrl = window.location.host + subpath + '/status';
            linkHost = window.location.host + subpath;
          } else {
            statusUrl = host.host.slice(0, -4) + subpath + '/status';
            linkHost = host.host.slice(0, -4) + subpath;
          }
          host.statusPage = this.sanitizer.bypassSecurityTrustResourceUrl(this.sanitizer.sanitize(SecurityContext.URL, statusUrl));
          host.link = linkHost;
        }
        return hosts;
      }),
      tap((hosts) => {
        if (this.hosts.length !== hosts.length) {
          this.hosts = hosts;
        }
      })
    );
    this.tip$ = this.stateService.chainTip$;
    this.websocketService.want(['blocks', 'tomahawk']);
  }

  scrollTo(host: HealthCheckHost): void {
    const el = document.getElementById(host.host);
    if (el) {
      el.scrollIntoView();
    }
  }

  trackByFn(index: number, host: HealthCheckHost): string {
    return host.host;
  }

  ngOnDestroy(): void {
    this.hosts = [];
  }
}
