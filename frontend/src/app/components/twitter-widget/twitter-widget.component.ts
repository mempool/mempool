import { Component, Input, ChangeDetectionStrategy, SecurityContext, SimpleChanges, OnInit, OnChanges, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { LanguageService } from '@app/services/language.service';
import { StateService } from '@app/services/state.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-twitter-widget',
  templateUrl: './twitter-widget.component.html',
  styleUrls: ['./twitter-widget.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwitterWidgetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() handle: string;
  @Input() width = 300;
  @Input() height = 400;

  loading: boolean = true;
  error: boolean = false;
  lang: string = 'en';

  iframeSrc: SafeResourceUrl;
  subscription: Subscription;

  constructor(
    private stateService: StateService,
    private languageService: LanguageService,
    public sanitizer: DomSanitizer,
    private cd: ChangeDetectorRef
  ) {
    this.lang = this.languageService.getLanguage();
    this.setIframeSrc();
  }

  ngOnInit() {
    const refreshMs = 60 * 60 * 1000; // hourly

    this.subscription = interval(refreshMs).subscribe(() => {
      this.setIframeSrc();
      this.cd.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.handle) {
      this.setIframeSrc();
    }
  }

  setIframeSrc(): void {
    if (!this.handle) {
      return;
    }
    const url = `${this.stateService.env.TWIDGET_API}/api/v1/social/x/${this.handle}`;
    this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(this.sanitizer.sanitize(SecurityContext.URL, url));
  }

  onReady(): void {
    this.loading = false;
    this.error = false;
  }

  onFailed(): void {
    this.loading = false;
    this.error = true;
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
