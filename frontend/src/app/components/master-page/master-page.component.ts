import { Component, OnInit, HostListener } from '@angular/core';
import { StateService } from '../../services/state.service';
import { env } from 'src/app/app.constants';

@Component({
  selector: 'app-master-page',
  templateUrl: './master-page.component.html',
  styleUrls: ['./master-page.component.scss']
})
export class MasterPageComponent implements OnInit {
  network = '';
  tvViewRoute = '/tv';
  env = env;

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
      });
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }
}
