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
  link: HTMLElement = document.getElementById('canonical');

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
        this.link.setAttribute('href', 'https://mempool.space' + (location.pathname === '/' ? '' : location.pathname));
      }
    });
  }
}
