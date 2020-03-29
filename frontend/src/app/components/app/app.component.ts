import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  network = environment.network;
  link: HTMLLinkElement;

  constructor(
    public router: Router,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit() {
    this.router.events.subscribe((val) => {
      if (val instanceof NavigationEnd) {
        if (this.network === 'liquid' || this.network === 'testnet') {
          this.updateCanonicalUrlElement('https://' + this.network + '.mempool.ninja' + location.pathname);
        } else {
          this.updateCanonicalUrlElement('https://mempool.space' + location.pathname);
        }
      }
    });
  }

  updateCanonicalUrlElement(url) {
    if (!this.link) {
      this.link = window.document.createElement('link');
      this.link.setAttribute('rel', 'canonical');
      window.document.head.appendChild(this.link);
    }
    this.link.setAttribute('href', url);
  }

}
