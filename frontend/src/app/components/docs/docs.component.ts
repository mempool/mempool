import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.scss']
})
export class DocsComponent implements OnInit {

  activeTab = 0;

  constructor(
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    const url = this.route.snapshot.url;
    this.activeTab = ( url[2].path === "rest" ) ? 0 : 1;
  }
}
