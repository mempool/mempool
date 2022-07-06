import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { restApiDocsData } from './api-docs-data';
import { faqData } from './api-docs-data';

@Component({
  selector: 'app-api-docs-nav',
  templateUrl: './api-docs-nav.component.html',
  styleUrls: ['./api-docs-nav.component.scss']
})
export class ApiDocsNavComponent implements OnInit {

  @Input() network: any;
  @Input() whichTab: string;
  @Output() navLinkClickEvent: EventEmitter<any> = new EventEmitter();
  tabData: any[];

  constructor() { }

  ngOnInit(): void {
    if (this.whichTab === 'rest') {
      this.tabData = restApiDocsData;
    } else if (this.whichTab === 'faq') {
      this.tabData = faqData;
    }
  }

  navLinkClick(event) {
    this.navLinkClickEvent.emit(event);
  }

}
