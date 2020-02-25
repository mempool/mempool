import { Component, OnInit } from '@angular/core';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-master-page',
  templateUrl: './master-page.component.html',
  styleUrls: ['./master-page.component.scss']
})
export class MasterPageComponent implements OnInit {
  navCollapsed = false;
  isOffline = false;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.stateService.isOffline$
      .subscribe((state) => {
        this.isOffline = state;
      });
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }
}
