import { Location } from '@angular/common';
import { Component, HostListener, OnInit, Inject, LOCALE_ID, HostBinding } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  link: HTMLElement = document.getElementById('canonical');

  constructor(
    public router: Router,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private location: Location,
    @Inject(LOCALE_ID) private locale: string
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
      this.class = 'rtl-layout';
    }
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
    this.router.events.subscribe(val => {
      if (val instanceof NavigationEnd) {
        this.link.setAttribute(
          'href',
          'https://mempool.space' + (this.location.path() === '/' ? '' : this.location.path())
        );
      }
    });
  }
}
