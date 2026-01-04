import { Component, Input, ChangeDetectionStrategy, SecurityContext, SimpleChanges, OnChanges } from '@angular/core';
import { LanguageService } from '@app/services/language.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-twitter-widget',
  templateUrl: './twitter-widget.component.html',
  styleUrls: ['./twitter-widget.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwitterWidgetComponent implements OnChanges {
  @Input() handle: string;
  @Input() width = 300;
  @Input() height = 400;

  loading: boolean = true;
  error: boolean = false;
  lang: string = 'en';

  iframeSrc: SafeResourceUrl;

  constructor(
    private languageService: LanguageService,
    public sanitizer: DomSanitizer,
  ) {
    this.lang = this.languageService.getLanguage();
    this.setIframeSrc();
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
    const url = `/api/v1/services/x/${this.handle}`;
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
}
