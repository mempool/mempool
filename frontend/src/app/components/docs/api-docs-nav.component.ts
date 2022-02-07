import { Component, OnInit, Input } from '@angular/core';
import { restApiDocsData } from './api-docs-data';

@Component({
  selector: 'app-api-docs-nav',
  templateUrl: './api-docs-nav.component.html',
  styleUrls: ['./api-docs-nav.component.scss']
})
export class ApiDocsNavComponent implements OnInit {

  @Input() network: any;
  @Input() collapseItem: any = { toggle: () => {} };
  restDocs: any[];

  constructor() { }

  ngOnInit(): void {
    this.restDocs = restApiDocsData;
  }

}
