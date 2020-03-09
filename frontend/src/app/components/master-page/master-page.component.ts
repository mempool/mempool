import { Component, OnInit } from '@angular/core';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-master-page',
  templateUrl: './master-page.component.html',
  styleUrls: ['./master-page.component.scss']
})
export class MasterPageComponent implements OnInit {
  navCollapsed = false;
  connectionState = 2;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.stateService.connectionState$
      .subscribe((state) => {
        this.connectionState = state;
      });
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }
}
