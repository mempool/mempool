import { Component, OnInit, LOCALE_ID, Inject, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { of, merge, Observable} from 'rxjs';
import { catchError, retry, scan, switchMap, tap } from 'rxjs/operators';

import { OptimizedMempoolStats } from '@interfaces/node-api.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { ApiService } from '@app/services/api.service';

import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { StorageService } from '@app/services/storage.service';
import { feeLevels, chartColors } from '@app/app.constants';
import { getStatsFeeBands, getStatsBandVsizes, getStatsBandLabel, StatsFeeBands } from '@app/shared/graphs.utils';
import { MempoolGraphComponent } from '@components/mempool-graph/mempool-graph.component';
import { IncomingTransactionsGraphComponent } from '@components/incoming-transactions-graph/incoming-transactions-graph.component';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss'],
  standalone: false,
})
export class StatisticsComponent implements OnInit {
  @ViewChild('mempoolgraph') mempoolGraph: MempoolGraphComponent;
  @ViewChild('incominggraph') incomingGraph: IncomingTransactionsGraphComponent;

  network = '';

  isLoading = true;
  feeLevels = feeLevels;
  chartColors = chartColors;
  filterSize = 100000;
  filterFeeIndex = 0;
  showCount = false;
  maxFeeIndex: number;
  dropDownOpen = false;
  outlierCappingEnabled = false;
  mempoolStats: OptimizedMempoolStats[];

  mempoolVsizeFeesData: any;
  mempoolUnconfirmedTransactionsData: any;
  mempoolTransactionsWeightPerSecondData: any;

  radioGroupForm: UntypedFormGroup;
  graphWindowPreference: string;
  inverted: boolean;
  feeLevelDropdownData = [];
  timespan = '';
  titleCount = $localize`Count`;
  statsError: any;

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
    this.setFeeLevelDropdownData(getStatsFeeBands([], this.stateService.isLiquid()));
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
      tap(() => {
        this.statsError = null;
        this.isLoading = true;
      }),
      switchMap(() => {
        this.timespan = this.radioGroupForm.controls.dateSpan.value;
        if (this.radioGroupForm.controls.dateSpan.value === '2h') {
          this.websocketService.want(['blocks', 'live-2h-chart']);
          return this.errorHandlerPipe(this.apiService.list2HStatistics$());
        }
        this.websocketService.want(['blocks']);
        if (this.radioGroupForm.controls.dateSpan.value === '24h') {
          return this.errorHandlerPipe(this.apiService.list24HStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '1w') {
          return this.errorHandlerPipe(this.apiService.list1WStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '1m') {
          return this.errorHandlerPipe(this.apiService.list1MStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '3m') {
          return this.errorHandlerPipe(this.apiService.list3MStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '6m') {
          return this.errorHandlerPipe(this.apiService.list6MStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '1y') {
          return this.errorHandlerPipe(this.apiService.list1YStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '2y') {
          return this.errorHandlerPipe(this.apiService.list2YStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '3y') {
          return this.errorHandlerPipe(this.apiService.list3YStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === '4y') {
          return this.errorHandlerPipe(this.apiService.list4YStatistics$());
        }
        if (this.radioGroupForm.controls.dateSpan.value === 'all') {
          return this.errorHandlerPipe(this.apiService.listAllTimeStatistics$());
        }
      }),
      switchMap((mempoolStats) => {
        if (this.radioGroupForm.controls.dateSpan.value === '2h') {
          return merge(
            this.stateService.live2Chart$.pipe(
              scan((acc, stats) => {
                const now = Date.now() / 1000;
                const start = now - (2 * 60 * 60);
                this.statsError = null;
                acc.unshift(stats);
                acc = acc.filter(p => p.added >= start);
                return acc;
              }, (mempoolStats || []))
            ),
            of(mempoolStats)
          );
        } else {
          return of(mempoolStats);
        }
      }),
    )
    .subscribe((mempoolStats: any) => {
      this.mempoolStats = mempoolStats;
      if (this.mempoolStats) {
        this.handleNewMempoolData(this.mempoolStats.concat([]));
      }
      this.isLoading = false;
    });
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    const feeBands = getStatsFeeBands(mempoolStats, this.stateService.isLiquid());
    const bandVsizes = mempoolStats.map(stats => getStatsBandVsizes(stats, feeBands));

    let maxTier = feeBands.levels.indexOf(1) - 1;
    for (let index = feeBands.levels.length - 1; index > -1; index--) {
      bandVsizes.forEach((vsizes) => {
        if (vsizes[index] >= this.filterSize) {
          maxTier = Math.max(maxTier, index);
        }
      });
    }
    this.maxFeeIndex = maxTier;
    this.setFeeLevelDropdownData(feeBands);

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

  errorHandlerPipe(obs: Observable<OptimizedMempoolStats[]>) {
    return obs.pipe(
      retry({ count: 3, delay: 1000 }),
      catchError((err) => {
        this.statsError = err;
        return of(null);
      }),
    );
  }

  setFeeLevelDropdownData(feeBands: StatsFeeBands) {
    const dropdownData = feeBands.levels.map((fee, index) => ({
      fee,
      index,
      range: getStatsBandLabel(feeBands, index),
      color: feeBands.colors[index],
    }));
    this.feeLevelDropdownData = this.inverted ? dropdownData : dropdownData.reverse();
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
