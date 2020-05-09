import { Component, OnInit, HostListener } from '@angular/core';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-master-page',
  templateUrl: './master-page.component.html',
  styleUrls: ['./master-page.component.scss']
})
export class MasterPageComponent implements OnInit {
  network = '';
  tvViewRoute = '/tv';

  navCollapsed = false;
  connectionState = 2;

  networkDropdownHidden = true;

  constructor(
    private stateService: StateService,
  ) { }

  @HostListener('document:click', ['$event'])
  documentClick(event: any): void {
    if (!event.target.classList.contains('dropdown-toggle')) {
      this.networkDropdownHidden = true;
    }
  }

  ngOnInit() {
    this.stateService.connectionState$
      .subscribe((state) => {
        this.connectionState = state;
      });

    this.stateService.networkChanged$
      .subscribe((network) => {
        this.network = network;

        if (network === 'testnet') {
          this.tvViewRoute = '/testnet-tv';
        } else if (network === 'liquid') {
          this.tvViewRoute = '/liquid-tv';
        } else {
          this.tvViewRoute = '/tv';
        }
      });
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }
}
