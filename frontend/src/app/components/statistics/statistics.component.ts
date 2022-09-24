import { Component, OnInit, LOCALE_ID, Inject, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormGroup, FormBuilder } from '@angular/forms';
import { of, merge} from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { OptimizedMempoolStats } from '../../interfaces/node-api.interface';
import { WebsocketService } from '../../services/websocket.service';
import { ApiService } from '../../services/api.service';

import { StateService } from '../../services/state.service';
import { SeoService } from '../../services/seo.service';
import { StorageService } from '../../services/storage.service';
import { feeLevels, chartColors } from '../../app.constants';
import { MempoolGraphComponent } from '../mempool-graph/mempool-graph.component';
import { IncomingTransactionsGraphComponent } from '../incoming-transactions-graph/incoming-transactions-graph.component';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  @ViewChild('mempoolgraph') mempoolGraph: MempoolGraphComponent;
  @ViewChild('incominggraph') incomingGraph: IncomingTransactionsGraphComponent;

  network = '';

  loading = true;
  spinnerLoading = false;
  feeLevels = feeLevels;
  chartColors = chartColors;
  filterFeeIndex = 1;
  dropDownOpen = false;

  mempoolStats: OptimizedMempoolStats[] = [];

  mempoolVsizeFeesData: any;
  mempoolUnconfirmedTransactionsData: any;
  mempoolTransactionsWeightPerSecondData: any;

  radioGroupForm: FormGroup;
  graphWindowPreference: string;
  inverted: boolean;
  feeLevelDropdownData = [];
  timespan = '';

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    public stateService: StateService,
    private seoService: SeoService,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.inverted = this.storageService.getValue('inverted-graph') === 'true';
    this.setFeeLevelDropdownData();
    this.seoService.setTitle($localize`:@@5d4f792f048fcaa6df5948575d7cb325c9393383:Graphs`);
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.graphWindowPreference = this.storageService.getValue('graphWindowPreference') ? this.storageService.getValue('graphWindowPreference').trim() : '2h';

    this.radioGroupForm = this.formBuilder.group({
      dateSpan: this.graphWindowPreference
    });

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['2h', '24h', '1w', '1m', '3m', '6m', '1y', '2y', '3y'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    merge(
      of(''),
      this.radioGroupForm.controls.dateSpan.valueChanges
    )
    .pipe(
      switchMap(() => {
        this.timespan = this.radioGroupForm.controls.dateSpan.value;
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
        if (this.radioGroupForm.controls.dateSpan.value === '1y') {
          return this.apiService.list1YStatistics$();
        }
        if (this.radioGroupForm.controls.dateSpan.value === '2y') {
          return this.apiService.list2YStatistics$();
        }
        return this.apiService.list3YStatistics$();
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

    this.capExtremeVbytesValues();

    this.mempoolTransactionsWeightPerSecondData = {
      labels: labels,
      series: [mempoolStats.map((stats) => [stats.added * 1000, stats.vbytes_per_second])],
    };
  }

  saveGraphPreference() {
    this.storageService.setValue('graphWindowPreference', this.radioGroupForm.controls.dateSpan.value);
  }

  invertGraph() {
    this.storageService.setValue('inverted-graph', !this.inverted);
    document.location.reload();
  }

  setFeeLevelDropdownData() {
    let _feeLevels = feeLevels
    let _chartColors = chartColors;
    if (!this.inverted) {
      _feeLevels = [...feeLevels].reverse();
      _chartColors = [...chartColors].reverse();
    }
    _feeLevels.forEach((fee, i) => {
      if (this.inverted) {
        this.feeLevelDropdownData.push({
          fee: fee,
          range: this.stateService.isLiquid() ? `${(_feeLevels[i] / 10).toFixed(1)} - ${(_feeLevels[i + 1] / 10).toFixed(1)}` : `${_feeLevels[i]} - ${_feeLevels[i + 1]}`,
          color: _chartColors[i],
        });
      } else {
        this.feeLevelDropdownData.push({
          fee: fee,
          range: this.stateService.isLiquid() ? `${(_feeLevels[i] / 10).toFixed(1)} - ${(_feeLevels[i - 1] / 10).toFixed(1)}` : `${_feeLevels[i]} - ${_feeLevels[i - 1]}`,
          color: _chartColors[i - 1],
        });
      }
    })
  }

  /**
   * All value higher that "median * capRatio" are capped
   */
  capExtremeVbytesValues() {
    if (this.stateService.network.length !== 0) {
      return; // Only cap on Bitcoin mainnet
    }

    let capRatio = 10;
    if (['1m', '3m',  '6m', '1y', '2y', '3y'].includes(this.graphWindowPreference)) {
      capRatio = 4;
    }

    // Find median value
    const vBytes: number[] = [];
    for (const stat of this.mempoolStats) {
      vBytes.push(stat.vbytes_per_second);
    }
    const sorted = vBytes.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    let median = sorted[middle];
    if (sorted.length % 2 === 0) {
      median = (sorted[middle - 1] + sorted[middle]) / 2;
    }

    // Cap
    for (const stat of this.mempoolStats) {
      stat.vbytes_per_second = Math.min(median * capRatio, stat.vbytes_per_second);
    }
  }

  onSaveChart(name) {
    if (name === 'mempool') {
      this.mempoolGraph.onSaveChart(this.timespan);
    } else if (name === 'incoming') {
      this.incomingGraph.onSaveChart(this.timespan);
    }
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
