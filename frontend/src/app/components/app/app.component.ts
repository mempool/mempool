import { Location } from '@angular/common';
import { Component, HostListener, OnInit, Inject, LOCALE_ID, HostBinding } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { StateService } from '../../services/state.service';
import { OpenGraphService } from '../../services/opengraph.service';
import { NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [NgbTooltipConfig]
})
export class AppComponent implements OnInit {
  link: HTMLElement = document.getElementById('canonical');

  constructor(
    public router: Router,
    private stateService: StateService,
    private openGraphService: OpenGraphService,
    private location: Location,
    tooltipConfig: NgbTooltipConfig,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
      this.class = 'rtl-layout';
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
    this.stateService.keyNavigation$.next(event);
  }

  ngOnInit() {
    this.router.events.subscribe((val) => {
      if (val instanceof NavigationEnd) {
        let domain = 'mempool.space';
        if (this.stateService.env.BASE_MODULE === 'liquid') {
          domain = 'liquid.network';
        } else if (this.stateService.env.BASE_MODULE === 'bisq') {
          domain = 'bisq.markets';
        }
        this.link.setAttribute('href', 'https://' + domain + this.location.path());
      }
    });
  }
}
