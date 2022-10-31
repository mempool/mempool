import { Component, OnDestroy, OnInit, AfterViewInit, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subscription, combineLatest, of } from 'rxjs';
import { map, switchMap, startWith, catchError, filter } from 'rxjs/operators';
import { BlockAudit, TransactionStripped } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { StateService } from '../../services/state.service';
import { detectWebGL } from '../../shared/graphs.utils';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { BlockOverviewGraphComponent } from '../block-overview-graph/block-overview-graph.component';

@Component({
  selector: 'app-block-audit',
  templateUrl: './block-audit.component.html',
  styleUrls: ['./block-audit.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class BlockAuditComponent implements OnInit, AfterViewInit, OnDestroy {
  blockAudit: BlockAudit = undefined;
  transactions: string[];
  auditSubscription: Subscription;
  urlFragmentSubscription: Subscription;

  paginationMaxSize: number;
  page = 1;
  itemsPerPage: number;

  mode: 'projected' | 'actual' = 'projected';
  error: any;
  isLoading = true;
  webGlEnabled = true;
  isMobile = window.innerWidth <= 767.98;
  hoverTx: string;

  childChangeSubscription: Subscription;

  blockHash: string;
  numMissing: number = 0;
  numUnexpected: number = 0;

  @ViewChildren('blockGraphProjected') blockGraphProjected: QueryList<BlockOverviewGraphComponent>;
  @ViewChildren('blockGraphActual') blockGraphActual: QueryList<BlockOverviewGraphComponent>;

  constructor(
    private route: ActivatedRoute,
    public stateService: StateService,
    private router: Router,
    private apiService: ApiService,
    private electrsApiService: ElectrsApiService,
  ) {
    this.webGlEnabled = detectWebGL();
  }

  ngOnDestroy() {
    this.childChangeSubscription.unsubscribe();
    this.urlFragmentSubscription.unsubscribe();
  }

  ngOnInit(): void {
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;
    this.itemsPerPage = this.stateService.env.ITEMS_PER_PAGE;

    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      if (fragment === 'actual') {
        this.mode = 'actual';
      } else {
        this.mode = 'projected'
      }
      this.setupBlockGraphs();
    });

    this.auditSubscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const blockHash = params.get('id') || null;
        if (!blockHash) {
          return null;
        }

        let isBlockHeight = false;
        if (/^[0-9]+$/.test(blockHash)) {
          isBlockHeight = true;
        } else {
          this.blockHash = blockHash;
        }

        if (isBlockHeight) {
          return this.electrsApiService.getBlockHashFromHeight$(parseInt(blockHash, 10))
            .pipe(
              switchMap((hash: string) => {
                if (hash) {
                  this.blockHash = hash;
                  return this.apiService.getBlockAudit$(this.blockHash)
                } else {
                  return null;
                }
              }),
              catchError((err) => {
                this.error = err;
                return of(null);
              }),
            );
        }
        return this.apiService.getBlockAudit$(this.blockHash)
      }),
      filter((response) => response != null),
      map((response) => {
        const blockAudit = response.body;
        const inTemplate = {};
        const inBlock = {};
        const isAdded = {};
        const isCensored = {};
        const isMissing = {};
        const isSelected = {};
        this.numMissing = 0;
        this.numUnexpected = 0;
        for (const tx of blockAudit.template) {
          inTemplate[tx.txid] = true;
        }
        for (const tx of blockAudit.transactions) {
          inBlock[tx.txid] = true;
        }
        for (const txid of blockAudit.addedTxs) {
          isAdded[txid] = true;
        }
        for (const txid of blockAudit.missingTxs) {
          isCensored[txid] = true;
        }
        // set transaction statuses
        for (const tx of blockAudit.template) {
          if (isCensored[tx.txid]) {
            tx.status = 'censored';
          } else if (inBlock[tx.txid]) {
            tx.status = 'found';
          } else {
            tx.status = 'missing';
            isMissing[tx.txid] = true;
            this.numMissing++;
          }
        }
        for (const [index, tx] of blockAudit.transactions.entries()) {
          if (index === 0) {
            tx.status = null;
          } else if (isAdded[tx.txid]) {
            tx.status = 'added';
          } else if (inTemplate[tx.txid]) {
            tx.status = 'found';
          } else {
            tx.status = 'selected';
            isSelected[tx.txid] = true;
            this.numUnexpected++;
          }
        }
        for (const tx of blockAudit.transactions) {
          inBlock[tx.txid] = true;
        }
        return blockAudit;
      }),
      catchError((err) => {
        console.log(err);
        this.error = err;
        this.isLoading = false;
        return of(null);
      }),
    ).subscribe((blockAudit) => {
      this.blockAudit = blockAudit;
      this.setupBlockGraphs();
      this.isLoading = false;
    });
  }

  ngAfterViewInit() {
    this.childChangeSubscription = combineLatest([this.blockGraphProjected.changes.pipe(startWith(null)), this.blockGraphActual.changes.pipe(startWith(null))]).subscribe(() => {
      this.setupBlockGraphs();
    })
  }

  setupBlockGraphs() {
    if (this.blockAudit) {
      this.blockGraphProjected.forEach(graph => {
        graph.destroy();
        if (this.isMobile && this.mode === 'actual') {
          graph.setup(this.blockAudit.transactions);
        } else {
          graph.setup(this.blockAudit.template);
        }
      })
      this.blockGraphActual.forEach(graph => {
        graph.destroy();
        graph.setup(this.blockAudit.transactions);
      })
    }
  }

  onResize(event: any) {
    const isMobile = event.target.innerWidth <= 767.98;
    const changed = isMobile !== this.isMobile;
    this.isMobile = isMobile;
    this.paginationMaxSize = event.target.innerWidth < 670 ? 3 : 5;

    if (changed) {
      this.changeMode(this.mode);
    }
  }

  changeMode(mode: 'projected' | 'actual') {
    this.router.navigate([], { fragment: mode });
  }

  onTxClick(event: TransactionStripped): void {
    const url = new RelativeUrlPipe(this.stateService).transform(`/tx/${event.txid}`);
    this.router.navigate([url]);
  }

  onTxHover(txid: string): void {
    if (txid && txid.length) {
      this.hoverTx = txid;
    } else {
      this.hoverTx = null;
    }
  }
}
