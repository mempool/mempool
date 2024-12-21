import { Component, OnInit, ChangeDetectionStrategy, SecurityContext, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { WebsocketService } from '@app/services/websocket.service';
import { Observable, Subject, Subscription, map, tap } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { HealthCheckHost } from '@interfaces/websocket.interface';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-server-status',
  templateUrl: './server-status.component.html',
  styleUrls: ['./server-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerStatusComponent implements OnInit, OnDestroy {
  tip$: Subject<number>;
  hosts: HealthCheckHost[] = [];
  hostSubscription: Subscription;

  constructor(
    private websocketService: WebsocketService,
    private stateService: StateService,
    private cd: ChangeDetectorRef,
    public sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.hostSubscription = this.stateService.serverHealth$.pipe(
      map((hosts) => {
        const subpath = window.location.pathname.slice(0, -6);
        for (const host of hosts) {
          let statusUrl = '';
          let linkHost = '';
          if (host.socket) {
            statusUrl = 'https://' + window.location.hostname + subpath + '/status';
            linkHost = window.location.hostname + subpath;
          } else {
            const hostUrl = new URL(host.host);
            statusUrl = 'https://' + hostUrl.hostname + subpath + '/status';
            linkHost = hostUrl.hostname + subpath;
          }
          host.statusPage = this.sanitizer.bypassSecurityTrustResourceUrl(this.sanitizer.sanitize(SecurityContext.URL, statusUrl));
          host.link = linkHost;
        }
        return hosts;
      }),
      tap((hosts) => {
        if (this.hosts.length !== hosts.length) {
          this.hosts = hosts.sort((a,b) => {
            const aParts = (a.host?.split('.') || []).reverse();
            const bParts = (b.host?.split('.') || []).reverse();
            let i = 0;
            while (i < Math.max(aParts.length, bParts.length)) {
              if (aParts[i] && !bParts[i]) {
                return 1;
              } else if (bParts[i] && !aParts[i]) {
                return -1;
              } else if (aParts[i] !== bParts[i]) {
                return aParts[i].localeCompare(bParts[i]);
              }
              i++;
            }
            return 0;
          });
        }
        this.cd.markForCheck();
      })
    ).subscribe();
    this.tip$ = this.stateService.chainTip$;
    this.websocketService.want(['mempool-blocks', 'stats', 'blocks', 'tomahawk']);
  }

  trackByFn(index: number, host: HealthCheckHost): string {
    return host.host;
  }

  ngOnDestroy(): void {
    this.hosts = [];
    this.hostSubscription.unsubscribe();
  }
}
