import { Location } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy, Inject, LOCALE_ID, HostBinding } from '@angular/core';
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
  standalone: false,
  providers: [NgbTooltipConfig]
})
export class AppComponent implements OnInit, OnDestroy {
  @HostBinding('attr.dir') dir = 'ltr';
  @HostBinding('class') class;

  private keydownHandlerBound: (event: KeyboardEvent) => void;

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

    // Bind the keyboard event handler
    this.keydownHandlerBound = (event: KeyboardEvent) => this.handleKeyboardEvents(event);
  }

  handleKeyboardEvents(event: KeyboardEvent) {
    if (!event) {
      return;
    }
    // Skip keyboard events when user is typing in input/textarea fields
    if (event.target && (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
      return;
    }
    // prevent arrow key horizontal scrolling
    if(["ArrowLeft","ArrowRight"].indexOf(event.code) > -1) {
      event.preventDefault();
    }
    this.stateService.keyNavigation$.next(event);
  }

  ngOnInit() {
    // Attach keyboard event listener directly to document for zoneless compatibility
    document.addEventListener('keydown', this.keydownHandlerBound, false);

    this.router.events.subscribe((val) => {
      if (val instanceof NavigationEnd) {
        this.seoService.updateCanonical(this.location.path());
      }
    });
  }

  ngOnDestroy() {
    // Remove keyboard event listener
    document.removeEventListener('keydown', this.keydownHandlerBound, false);
  }
}
