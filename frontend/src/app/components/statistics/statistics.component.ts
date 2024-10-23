import { Component, OnInit, LOCALE_ID, Inject, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { of, merge} from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { OptimizedMempoolStats } from '@interfaces/node-api.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { ApiService } from '@app/services/api.service';

import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { StorageService } from '@app/services/storage.service';
import { feeLevels, chartColors } from '@app/app.constants';
import { MempoolGraphComponent } from '@components/mempool-graph/mempool-graph.component';
import { IncomingTransactionsGraphComponent } from '@components/incoming-transactions-graph/incoming-transactions-graph.component';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  @ViewChild('mempoolgraph') mempoolGraph: MempoolGraphComponent;
  @ViewChild('incominggraph') incomingGraph: IncomingTransactionsGraphComponent;

  network = '';

  isLoading = true;
  feeLevels = feeLevels;
  chartColors = chartColors;
  filterSize = 100000;
  filterFeeIndex = 1;
  showCount = false;
  maxFeeIndex: number;
  dropDownOpen = false;
  outlierCappingEnabled = false;
  mempoolStats: OptimizedMempoolStats[] = [];

  mempoolVsizeFeesData: any;
  mempoolUnconfirmedTransactionsData: any;
  mempoolTransactionsWeightPerSecondData: any;

  radioGroupForm: UntypedFormGroup;
  graphWindowPreference: string;
  inverted: boolean;
  feeLevelDropdownData = [];
  timespan = '';
  titleCount = $localize`Count`;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private formBuilder: UntypedFormBuilder,
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
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.mempool:See mempool size (in MvB) and transactions per second (in vB/s) visualized over time.`);
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.graphWindowPreference = this.storageService.getValue('graphWindowPreference') ? this.storageService.getValue('graphWindowPreference').trim() : '2h';
    this.outlierCappingEnabled = this.storageService.getValue('cap-outliers') === 'true';

    this.radioGroupForm = this.formBuilder.group({
      dateSpan: this.graphWindowPreference
    });

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['2h', '24h', '1w', '1m', '3m', '6m', '1y', '2y', '3y', '4y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        } else {
          this.radioGroupForm.controls.dateSpan.setValue('2h', { emitEvent: false });
        }
      });

    merge(
      of(''),
      this.radioGroupForm.controls.dateSpan.valueChanges
    )
    .pipe(
      switchMap(() => {
        this.timespan = this.radioGroupForm.controls.dateSpan.value;
        this.isLoading = true;
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
        if (this.radioGroupForm.controls.dateSpan.value === '3y') {
          return this.apiService.list3YStatistics$();
        }
        if (this.radioGroupForm.controls.dateSpan.value === '4y') {
          return this.apiService.list4YStatistics$();
        }
        if (this.radioGroupForm.controls.dateSpan.value === 'all') {
          return this.apiService.listAllTimeStatistics$();
        }
      })
    )
    .subscribe((mempoolStats: any) => {
      this.mempoolStats = mempoolStats;
      this.handleNewMempoolData(this.mempoolStats.concat([]));
      this.isLoading = false;
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

    let maxTier = 0;
    for (let index = 37; index > -1; index--) {
      mempoolStats.forEach((stats) => {
        if (stats.vsizes[index] >= this.filterSize) {
          maxTier = Math.max(maxTier, index);
        }
      });
    }
    this.maxFeeIndex = maxTier;

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
    let _feeLevels = feeLevels;
    let _chartColors = chartColors;
    if (!this.inverted) {
      _feeLevels = [...feeLevels].reverse();
      _chartColors = [...chartColors].reverse();
    }
    _feeLevels.forEach((fee, i) => {
      let range;
      const nextIndex = this.inverted ? i + 1 : i - 1;
      if (this.stateService.isLiquid()) {
        if (_feeLevels[nextIndex] == null) {
          range = `${(_feeLevels[i] / 10).toFixed(1)}+`;
        } else {
          range = `${(_feeLevels[i] / 10).toFixed(1)} - ${(_feeLevels[nextIndex] / 10).toFixed(1)}`;
        }
      } else {
        if (_feeLevels[nextIndex] == null) {
          range = `${_feeLevels[i]}+`;
        } else {
          range = `${_feeLevels[i]} - ${_feeLevels[nextIndex]}`;
        }
      }
      if (this.inverted) {
        this.feeLevelDropdownData.push({
          fee: fee,
          range,
          color: _chartColors[i],
        });
      } else {
        this.feeLevelDropdownData.push({
          fee: fee,
          range,
          color: _chartColors[i],
        });
      }
    });
  }
  
  onOutlierToggleChange(e): void {
    this.outlierCappingEnabled = e.target.checked;
    this.storageService.setValue('cap-outliers', e.target.checked);
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
