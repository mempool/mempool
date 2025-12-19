import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Env, StateService } from '@app/services/state.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { restApiDocsData, wsApiDocsData } from '@app/docs/api-docs/api-docs-data';
import { faqData } from '@app/docs/api-docs/api-docs-data';

@Component({
  selector: 'app-api-docs-nav',
  templateUrl: './api-docs-nav.component.html',
  styleUrls: ['./api-docs-nav.component.scss'],
  standalone: false,
})
export class ApiDocsNavComponent implements OnInit {

  @Input() network: any;
  @Input() whichTab: string;
  @Output() navLinkClickEvent: EventEmitter<any> = new EventEmitter();
  private destroy$: Subject<any> = new Subject<any>();
  env: Env;
  tabData: any[];
  auditEnabled: boolean;
  officialMempoolInstance: boolean;
  isMempoolSpaceBuild: boolean;
  runningElectrs: boolean;

  constructor(
    private stateService: StateService
  ) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.officialMempoolInstance = this.env.OFFICIAL_MEMPOOL_SPACE;
    this.isMempoolSpaceBuild = this.stateService.isMempoolSpaceBuild;
    this.stateService.backend$.pipe(takeUntil(this.destroy$)).subscribe((backend) => {
      this.runningElectrs = !!(backend == 'esplora');
    });
    this.auditEnabled = this.env.AUDIT;
    if (this.whichTab === 'rest') {
      this.tabData = restApiDocsData;
    } else if (this.whichTab === 'websocket') {
      this.tabData = wsApiDocsData;
    } else if (this.whichTab === 'faq') {
      this.tabData = faqData;
    }
  }

  navLinkClick(event, fragment) {
    event.preventDefault();
    this.navLinkClickEvent.emit({event: event, fragment: fragment});
  }

  ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.complete();
  }

}
