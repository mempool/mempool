import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { LanguageService } from '@app/services/language.service';

const SESSION_KEY = 'mlytx';
const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FLUSH_IDLE_MS = 5_000;
const FLUSH_MAX_MS = 30_000;

interface SessionEntry {
  id: string;
  ts: number;
  st: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private baseUrl: string;
  private sessionId: string;
  private startTime: number;
  private locale: string | undefined;
  private buffer: Record<string, unknown>[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  public enabled = false;

  constructor(
    @Inject(PLATFORM_ID) platformId: any,
    private router: Router,
    private http: HttpClient,
    private stateService: StateService,
    private languageService: LanguageService,
  ) {
    if (!isPlatformBrowser(platformId) || !this.stateService.env.ANALYTICS_URL || !this.trackingAllowed() || this.doNotTrack()) {
      this.enabled = false;
      return;
    }
    this.enabled = true;
    this.baseUrl = this.stateService.env.ANALYTICS_URL;

    const lang = this.languageService.getLanguage();
    this.locale = lang && lang !== 'en' ? lang : undefined;

    if (!this.restoreSession()) {
      this.startNewSession();
    }

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.unload();
      }
    });
    window.addEventListener('beforeunload', () => {
      this.unload();
    });
    window.addEventListener('pagehide', () => {
      this.unload();
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => {
      const { path, network } = this.getRouteTemplate();
      this.view(path, network);
    });
  }

  view(path: string, network?: string): void {
    if (!this.baseUrl || !this.enabled) {
      return;
    }
    const event: Record<string, unknown> = { t: 'v', p: path };
    if (network) {
      event.n = network;
    }
    if (this.locale) {
      event.l = this.locale;
    }
    this.pushEvent(event);
  }

  action(path: string, id: string, params?: Record<string, unknown>, network?: string): void {
    if (!this.baseUrl || !this.enabled) {
      return;
    }
    const event: Record<string, unknown> = { t: 'a', p: path, id };
    if (network) {
      event.n = network;
    }
    if (this.locale) {
      event.l = this.locale;
    }
    if (params && Object.keys(params).length) {
      event.params = params;
    }
    this.pushEvent(event);
  }

  unload(): void {
    if (!this.baseUrl || !this.enabled || !this.buffer.length) {
      return;
    }
    this.clearTimers();
    this.flush();
  }

  private restoreSession(): boolean {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const entry: SessionEntry = JSON.parse(raw);
        const now = Date.now();
        if (entry.id && (now - entry.ts) < SESSION_TIMEOUT_MS && (now - entry.st) < SESSION_MAX_AGE_MS) {
          this.sessionId = entry.id;
          this.startTime = entry.st;
          return true;
        }
      }
    } catch { }
    return false;
  }

  private startNewSession(): void {
    if (!this.enabled) {
      return;
    }
    this.sessionId = crypto.randomUUID();
    this.startTime = Date.now();
    this.saveSession(this.sessionId);
    const sessionEvent = { t: 's', td: 0, ...this.buildSessionPayload() };
    this.http.post(this.baseUrl, { s: this.sessionId, events: [sessionEvent] }).subscribe();
  }

  private saveSession(id: string): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now(), st: this.startTime }));
    } catch {
      // failed to save session, ignore
    }
  }

  private pushEvent(event: Record<string, unknown>): void {
    if (!this.enabled) {
      return;
    }
    if (Date.now() - this.startTime >= SESSION_MAX_AGE_MS) {
      this.buffer.push({ t: 'x', td: Date.now() - this.startTime });
      this.flush();
      this.startNewSession();
    }
    event.td = Date.now() - this.startTime;
    this.buffer.push(event);
    this.scheduleFlush();
  }

  private buildSessionPayload(): Record<string, string> {
    const payload: Record<string, string> = {};

    payload.d = window.location.hostname;

    const referrer = document.referrer;
    if (referrer) {
      payload.r = referrer;
    }

    const params = new URLSearchParams(window.location.search);
    const utmMap: Record<string, string> = {
      utm_source: 'us',
      utm_medium: 'um',
      utm_campaign: 'uc',
      utm_term: 'ut',
      utm_content: 'un',
    };
    for (const [param, key] of Object.entries(utmMap)) {
      const val = params.get(param);
      if (val) {
        payload[key] = val;
      }
    }

    return payload;
  }

  private scheduleFlush(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => this.flush(), FLUSH_IDLE_MS);

    if (this.maxTimer === null) {
      this.maxTimer = setTimeout(() => this.flush(), FLUSH_MAX_MS);
    }
  }

  private clearTimers(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.maxTimer !== null) {
      clearTimeout(this.maxTimer);
      this.maxTimer = null;
    }
  }

  private flush(): void {
    if (!this.enabled || !this.buffer.length) {
      return;
    }
    this.clearTimers();
    const payload = this.flushPayload();
    if (payload) {
      fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  }

  private flushPayload(): Record<string, unknown> | null {
    if (!this.enabled) {
      return null;
    }
    const events = this.buffer;
    this.buffer = [];
    if (events.length) {
      return { s: this.sessionId, events, td: Date.now() - this.startTime };
    } else {
      return null;
    }
  }

  private trackingAllowed(): boolean {
    if (this.stateService.env.OFFICIAL_MEMPOOL_SPACE) {
      return true;
    }
    const hostname = window.location.hostname;
    if (hostname === 'mempool.space' || hostname.endsWith('.mempool.space')) {
      return true;
    }
    if (this.stateService.env.customize?.enterprise) {
      return true;
    }
    return false;
  }

  private doNotTrack(): boolean {
    const dnt = (navigator as any).doNotTrack ?? (window as any).doNotTrack ?? (navigator as any).msDoNotTrack;
    return dnt != null && (parseInt(dnt, 10) === 1 || dnt === 'yes');
  }

  private getRouteTemplate(): { path: string; network?: string } {
    let route = this.router.routerState.snapshot.root;
    const segments: string[] = [];
    while (route) {
      if (route.routeConfig?.path) {
        segments.push(route.routeConfig.path);
      }
      route = route.firstChild;
    }
    const template = '/' + segments.join('/') || '/';
    const network = this.stateService.network || undefined;
    return { path: template, network };
  }
}
