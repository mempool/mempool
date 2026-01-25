import { Component, OnInit, ChangeDetectionStrategy, SecurityContext, ChangeDetectorRef } from '@angular/core';
import { WebsocketService } from '@app/services/websocket.service';
import { Observable, map, tap } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { HealthCheckHost } from '@interfaces/websocket.interface';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-server-health',
  templateUrl: './server-health.component.html',
  styleUrls: ['./server-health.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerHealthComponent implements OnInit {
  hosts$: Observable<HealthCheckHost[]>;
  maxHeight: number;
  interval: number;
  now: number = Date.now();
  colors: Record<string, Record<string, string>> = {};

  repoMap = {
    frontend: 'mempool',
    hybrid: 'mempool.space',
    backend: 'mempool',
    electrs: 'electrs',
    ssr: 'mempool.space',
  };

  constructor(
    private websocketService: WebsocketService,
    private stateService: StateService,
    private cd: ChangeDetectorRef,
    public sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.hosts$ = this.stateService.serverHealth$.pipe(
      map((hosts) => {
        const subpath = window.location.pathname.slice(0, -11);
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
          host.flag = this.parseFlag(host.host);
        }
        return hosts;
      }),
      tap(hosts => {
        let newMaxHeight = 0;
        for (const host of hosts) {
          newMaxHeight = Math.max(newMaxHeight, host.latestHeight);
        }

        const sortedCoreVersions = [...new Set(
          hosts.map(h => this.parseVersion(h.hashes?.core)).filter(Boolean)
        )].sort((a, b) => this.compareVersions(a, b));

        const sortedOsVersions = [...new Set(
          hosts.map(h => this.parseOsVersion(h.hashes?.os)).filter(Boolean)
        )].sort((a, b) => this.compareVersions(a, b));

        this.colors = {};
        for (const host of hosts) {
          this.colors[host.host] = {};
          for (const type of ['hybrid', 'frontend', 'backend', 'electrs', 'ssr', 'core', 'os']) {
            if (type === 'core') {
              const version = this.parseVersion(host.hashes?.core);
              this.colors[host.host][type] = version ? this.getVersionColor(version, sortedCoreVersions) : '';
            } else if (type === 'os') {
              const version = this.parseOsVersion(host.hashes?.os);
              this.colors[host.host][type] = version ? this.getVersionColor(version, sortedOsVersions) : '';
            } else {
              const hash = host.hashes?.[type];
              this.colors[host.host][type] = hash ? '#' + hash.slice(0, 6) : '';
            }
          }
        }
      })
    );
    this.websocketService.want(['mempool-blocks', 'stats', 'blocks', 'tomahawk']);

    this.interval = window.setInterval(() => {
      this.now = Date.now();
      this.cd.markForCheck();
    }, 1000);
  }

  trackByFn(index: number, host: HealthCheckHost): string {
    return host.host;
  }

  getLastUpdateSeconds(host: HealthCheckHost): string {
    if (host.lastChecked) {
      const seconds = Math.ceil((this.now - host.lastChecked) / 1000);
      return `${seconds} s`;
    } else {
      return '~';
    }
  }

  private parseFlag(host: string): string {
    if (host.includes('.fra.')) {
      return '🇩🇪';
    } else if (host.includes('.tk7.')) {
      return '🇯🇵';
    } else if (host.includes('.fmt.')) {
      return '🇺🇸';
    } else if (host.includes('.va1.')) {
      return '🇺🇸';
    } else if (host.includes('.sg1.')) {
      return '🇸🇬';
    } else if (host.includes('.hnl.')) {
      return '🤙';
    } else {
      return '';
    }
  }

  private parseVersion(subver: string): string | undefined {
    if (subver) {
      const match = subver.match(/:(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    }
  }

  private parseOsVersion(osVersion: string): string | undefined {
    if (osVersion) {
      const match = osVersion.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
      return match ? `${match[1]}.${match[2]}.${match[3] ?? 0}` : null;
    }
  }

  public shortenVersion(version: string): string {
    return version.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? '';
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (partsA[i] !== partsB[i]) {
        return partsA[i] - partsB[i];
      }
    }
    return 0;
  }

  private getVersionColor(version: string, sortedVersions: string[]): string {
    if (!version || sortedVersions.length === 0) {
      return '';
    }
    const index = sortedVersions.indexOf(version);
    if (index === -1) {
      return '';
    }

    if (sortedVersions.length === 1) {
      return 'hsl(120, 70%, 35%)';
    }

    const hue = (index / (sortedVersions.length - 1)) * 120;
    return `hsl(${hue}, 70%, 35%)`;
  }
}
