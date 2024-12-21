import { Location } from '@angular/common';
import { Component, HostListener, OnInit, Inject, LOCALE_ID, HostBinding } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { StateService } from '@app/services/state.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { ThemeService } from '@app/services/theme.service';
import { SeoService } from '@app/services/seo.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [NgbTooltipConfig]
})
export class AppComponent implements OnInit {
  constructor(
    public router: Router,
    private stateService: StateService,
    private openGraphService: OpenGraphService,
    private seoService: SeoService,
    private themeService: ThemeService,
    private location: Location,
    tooltipConfig: NgbTooltipConfig,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
      this.class = 'rtl-layout';
    } else {
      this.class = 'ltr-layout';
    }

    tooltipConfig.animation = false;
    tooltipConfig.container = 'body';
    tooltipConfig.triggers = 'hover';
  }

  @HostBinding('attr.dir') dir = 'ltr';
  @HostBinding('class') class;

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvents(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    // prevent arrow key horizontal scrolling
    if(["ArrowLeft","ArrowRight"].indexOf(event.code) > -1) {
      event.preventDefault();
    }
    this.stateService.keyNavigation$.next(event);
  }

  ngOnInit() {
    this.router.events.subscribe((val) => {
      if (val instanceof NavigationEnd) {
        this.seoService.updateCanonical(this.location.path());
      }
    });
  }
}
