import { Component, HostListener, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  link: HTMLLinkElement;

  constructor(
    public router: Router,
    private websocketService: WebsocketService,
    private stateService: StateService,
  ) { }

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
        this.updateCanonicalUrlElement('https://mempool.space' + location.pathname);
      }
    });
  }

  updateCanonicalUrlElement(url: string) {
    if (!this.link) {
      this.link = window.document.createElement('link');
      this.link.setAttribute('rel', 'canonical');
      window.document.head.appendChild(this.link);
    }
    this.link.setAttribute('href', url);
  }


}
