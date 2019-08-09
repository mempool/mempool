import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor(
    private apiService: ApiService,
  ) { }

  ngOnInit() {
    this.apiService.webSocketWant([]);
  }

}
