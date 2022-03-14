import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { restApiDocsData } from './api-docs-data';

@Component({
  selector: 'app-api-docs-nav',
  templateUrl: './api-docs-nav.component.html',
  styleUrls: ['./api-docs-nav.component.scss']
})
export class ApiDocsNavComponent implements OnInit {

  @Input() network: any;
  @Output() navLinkClickEvent: EventEmitter<any> = new EventEmitter();
  restDocs: any[];

  constructor() { }

  ngOnInit(): void {
    this.restDocs = restApiDocsData;
  }
  
  navLinkClick( event ) {
    this.navLinkClickEvent.emit( event );
  }

}
