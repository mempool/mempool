import { Component, OnInit } from '@angular/core';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-api-docs',
  templateUrl: './api-docs.component.html',
  styleUrls: ['./api-docs.component.scss']
})
export class ApiDocsComponent implements OnInit {
  hostname = document.location.hostname;
  active = 1;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    if (this.stateService.network === 'bisq') {
      this.active = 2;
    }
    if (document.location.port !== '') {
      this.hostname = this.hostname + ':' + document.location.port;
    }
  }

}
