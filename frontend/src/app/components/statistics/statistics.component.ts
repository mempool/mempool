import { Component, OnInit, LOCALE_ID, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormGroup, FormBuilder } from '@angular/forms';
import { of, merge} from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { OptimizedMempoolStats } from '../../interfaces/node-api.interface';
import { WebsocketService } from '../../services/websocket.service';
import { ApiService } from '../../services/api.service';

import { StateService } from 'src/app/services/state.service';
import { SeoService } from 'src/app/services/seo.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  network = '';

  loading = true;
  spinnerLoading = false;

  mempoolStats: OptimizedMempoolStats[] = [];

  mempoolVsizeFeesData: any;
  mempoolUnconfirmedTransactionsData: any;
  mempoolTransactionsWeightPerSecondData: any;

  radioGroupForm: FormGroup;
  graphWindowPreference: String;
  inverted: boolean;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private stateService: StateService,
    private seoService: SeoService,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.inverted = this.storageService.getValue('inverted-graph') === 'true';
    this.seoService.setTitle($localize`:@@5d4f792f048fcaa6df5948575d7cb325c9393383:Graphs`);
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.graphWindowPreference = this.storageService.getValue('graphWindowPreference') ? this.storageService.getValue('graphWindowPreference').trim() : '2h';
    const isMobile = window.innerWidth <= 767.98;
    let labelHops = isMobile ? 48 : 24;

    if (isMobile) {
      labelHops = 96;
    }

    this.radioGroupForm = this.formBuilder.group({
      dateSpan: this.graphWindowPreference
    });

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['2h', '24h', '1w', '1m', '3m', '6m', '1y'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    merge(
      of(''),
      this.radioGroupForm.controls.dateSpan.valueChanges
    )
    .pipe(
      switchMap(() => {
        this.spinnerLoading = true;
        if (this.radioGroupForm.controls.dateSpan.value === '2h') {
          this.websocketService.want(['blocks', 'live-2h-chart']);
          return this.apiService.list2HStatistics$();
        }
        this.websocketService.want(['blocks']);
        if (this.radioGroupForm.controls.dateSpan.value === '24h') {
          return this.apiService.list24HStatistics$();
        }
        if (this.radioGroupForm.controls.dateSpan.value === '1w') {
          return this.apiService.list1WStatistics$();
        }
        if (this.radioGroupForm.controls.dateSpan.value === '1m') {
          return this.apiService.list1MStatistics$();
        }
        if (this.radioGroupForm.controls.dateSpan.value === '3m') {
          return this.apiService.list3MStatistics$();
        }
        if (this.radioGroupForm.controls.dateSpan.value === '6m') {
          return this.apiService.list6MStatistics$();
        }
        return this.apiService.list1YStatistics$();
      })
    )
    .subscribe((mempoolStats: any) => {
      this.mempoolStats = mempoolStats;
      this.handleNewMempoolData(this.mempoolStats.concat([]));
      this.loading = false;
      this.spinnerLoading = false;
    });

    this.stateService.live2Chart$
      .subscribe((mempoolStats) => {
        this.mempoolStats.unshift(mempoolStats);
        this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - 1);
        this.handleNewMempoolData(this.mempoolStats.concat([]));
      });
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    this.mempoolTransactionsWeightPerSecondData = {
      labels: labels,
      series: [mempoolStats.map((stats) => stats.vbytes_per_second)],
    };
  }

  saveGraphPreference() {
    this.storageService.setValue('graphWindowPreference', this.radioGroupForm.controls.dateSpan.value);
  }

  invertGraph() {
    this.storageService.setValue('inverted-graph', !this.inverted);
    document.location.reload();
  }
}
