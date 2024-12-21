import { Component, Input, ChangeDetectionStrategy, SecurityContext, SimpleChanges, OnChanges } from '@angular/core';
import { LanguageService } from '@app/services/language.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-twitter-widget',
  templateUrl: './twitter-widget.component.html',
  styleUrls: ['./twitter-widget.component.scss'],
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
    if (this.handle) {
      this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(this.sanitizer.sanitize(SecurityContext.URL,
        `https://syndication.x.com/srv/timeline-profile/screen-name/${this.handle}?creatorScreenName=mempool`
        + '&dnt=true'
        + '&embedId=twitter-widget-0'
        + '&features=eyJ0ZndfdGltZWxpbmVfgbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidGZ3X2ZvbGxvd2VyX2NvdW50X3N1bnNldCI6eyJidWNrZXQiOnRydWUsInZlcnNpb24iOm51bGx9LCJ0ZndfdHdlZXRfZWRpdF9iYWNrZW5kIjp7ImJ1Y2tldCI6Im9uIiwidmVyc2lvbiI6bnVsbH0sInRmd19yZWZzcmNfc2Vzc2lvbiI6eyJidWNrZXQiOiJvbiIsInZlcnNpb24iOm51bGx9LCJ0ZndfZm9zbnJfc29mdF9pbnRlcnZlbnRpb25zX2VuYWJsZWQiOnsiYnVja2V0Ijoib24iLCJ2ZXJzaW9uIjpudWxsfSwidGZ3X21peGVkX21lZGlhXzE1ODk3Ijp7ImJ1Y2tldCI6InRyZWF0bWVudCIsInZlcnNpb24iOm51bGx9LCJ0ZndfZXhwZXJpbWVudHNfY29va2llX2V4cGlyYXRpb24iOnsiYnVja2V0IjoxMjA5NjAwLCJ2ZXJzaW9uIjpudWxsfSwidGZ3X3Nob3dfYmlyZHdhdGNoX3Bpdm90c19lbmFibGVkIjp7ImJ1Y2tldCI6Im9uIiwidmVyc2lvbiI6bnVsbH0sInRmd19kdXBsaWNhdGVfc2NyaWJlc190b19zZXR0aW5ncyI6eyJidWNrZXQiOiJvbiIsInZlcnNpb24iOm51bGx9LCJ0ZndfdXNlX3Byb2ZpbGVfaW1hZ2Vfc2hhcGVfZW5hYmxlZCI6eyJidWNrZXQiOiJvbiIsInZlcnNpb24iOm51bGx9LCJ0ZndfdmlkZW9faGxzX2R5bmFtaWNfbWFuaWZlc3RzXzE1MDgyIjp7ImJ1Y2tldCI6InRydWVfYml0cmF0ZSIsInZlcnNpb24iOm51bGx9LCJ0ZndfbGVnYWN5X3RpbWVsaW5lX3N1bnNldCI6eyJidWNrZXQiOnRydWUsInZlcnNpb24iOm51bGx9LCJ0ZndfdHdlZXRfZWRpdF9mcm9udGVuZCI6eyJidWNrZXQiOiJvbiIsInZlcnNpb24iOm51bGx9fQ%3D%3D'
        + '&frame=false'
        + '&hideBorder=true'
        + '&hideFooter=false'
        + '&hideHeader=true'
        + '&hideScrollBar=false'
        + `&lang=${this.lang}`
        + '&maxHeight=500px'
        + '&origin=https%3A%2F%2Fmempool.space%2F'
        // + '&sessionId=88f6d661d0dcca99c43c0a590f6a3e61c89226a9'
        + '&showHeader=false'
        + '&showReplies=false'
        + '&siteScreenName=mempool'
        + '&theme=dark'
        + '&transparent=true'
        + '&widgetsVersion=2615f7e52b7e0%3A1702314776716'
      ));
    }
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
