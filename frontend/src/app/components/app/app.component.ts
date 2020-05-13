import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  network = '';
  link: HTMLLinkElement;

  constructor(
    public router: Router,
    private websocketService: WebsocketService,
    private stateService: StateService,
  ) { }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvents(event: KeyboardEvent) {
    if (event.target !== document.body) {
      return;
    }
    this.stateService.keyNavigation$.next(event);
  }

}
