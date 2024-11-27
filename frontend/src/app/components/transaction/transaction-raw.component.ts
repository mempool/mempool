import { Component, OnInit, HostListener, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Transaction } from '@interfaces/electrs.interface';
import { StateService } from '../../services/state.service';
import { Filter, toFilters } from '../../shared/filters.utils';
import { decodeRawTransaction, getTransactionFlags, addInnerScriptsToVin, countSigops } from '../../shared/transaction.utils';
import { ETA, EtaService } from '../../services/eta.service';
import { combineLatest, firstValueFrom, map, Observable, startWith, Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { ActivatedRoute, Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { SeoService } from '../../services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { ApiService } from '../../services/api.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-transaction-raw',
  templateUrl: './transaction-raw.component.html',
  styleUrls: ['./transaction-raw.component.scss'],
})
export class TransactionRawComponent implements OnInit, OnDestroy {

  pushTxForm: UntypedFormGroup;
  isLoading: boolean;
  offlineMode: boolean = false;
  transaction: Transaction;
  error: string;
  errorPrevouts: string;
  hasPrevouts: boolean;
  prevoutsLoadedCount: number = 0;
  prevoutsCount: number;
  isLoadingBroadcast: boolean;
  errorBroadcast: string;
  successBroadcast: boolean;

  isMobile: boolean;
  @ViewChild('graphContainer')
  graphContainer: ElementRef;
  graphExpanded: boolean = false;
  graphWidth: number = 1068;
  graphHeight: number = 360;
  inOutLimit: number = 150;
  maxInOut: number = 0;
  flowPrefSubscription: Subscription;
  hideFlow: boolean = this.stateService.hideFlow.value;
  flowEnabled: boolean;
  adjustedVsize: number;
  filters: Filter[] = [];
  showCpfpDetails = false;
  ETA$: Observable<ETA | null>;
  mempoolBlocksSubscription: Subscription;

  constructor(
    public route: ActivatedRoute,
    public router: Router,
    public stateService: StateService,
    public etaService: EtaService,
    public electrsApi: ElectrsApiService,
    public websocketService: WebsocketService,
    public formBuilder: UntypedFormBuilder,
    public cd: ChangeDetectorRef,
    public seoService: SeoService,
    public apiService: ApiService,
    public relativeUrlPipe: RelativeUrlPipe,
  ) {}

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@meta.title.preview-tx:Preview Transaction`);
    this.seoService.setDescription($localize`:@@meta.description.preview-tx:Preview a transaction to the Bitcoin${seoDescriptionNetwork(this.stateService.network)} network using the transaction's raw hex data.`);
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.pushTxForm = this.formBuilder.group({
      txRaw: ['', Validators.required],
    });
  }

  async decodeTransaction(): Promise<void> {
    this.resetState();
    this.isLoading = true;
    try {
      const tx = decodeRawTransaction(this.pushTxForm.get('txRaw').value, this.stateService.network);
      await this.fetchPrevouts(tx);
      this.processTransaction(tx);
    } catch (error) {
      this.error = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  async fetchPrevouts(transaction: Transaction): Promise<void> {
    if (this.offlineMode) {
      return;
    }

    this.prevoutsCount = transaction.vin.filter(input => !input.is_coinbase).length;
    if (this.prevoutsCount === 0) {
      this.hasPrevouts = true;
      return;
    }

    const txsToFetch: { [txid: string]: number } = transaction.vin.reduce((acc, input) => {
      if (!input.is_coinbase) {
        acc[input.txid] = (acc[input.txid] || 0) + 1;
      }
      return acc;
    }, {} as { [txid: string]: number });

    try {

      if (Object.keys(txsToFetch).length > 20) {
        throw new Error($localize`:@@transaction.too-many-prevouts:Too many transactions to fetch (${Object.keys(txsToFetch).length})`);
      }

      const fetchedTransactions = await Promise.all(
        Object.keys(txsToFetch).map(txid =>
          firstValueFrom(this.electrsApi.getTransaction$(txid))
            .then(response => {
              this.prevoutsLoadedCount += txsToFetch[txid];
              this.cd.markForCheck();
              return response;
            })
        )
      );
  
      const transactionsMap = fetchedTransactions.reduce((acc, transaction) => {
        acc[transaction.txid] = transaction;
        return acc;
      }, {} as { [txid: string]: any });
  
      const prevouts = transaction.vin.map((input, index) => ({ index, prevout: transactionsMap[input.txid]?.vout[input.vout] || null}));
  
      transaction.vin = transaction.vin.map((input, index) => {
        if (!input.is_coinbase) {
          input.prevout = prevouts.find(p => p.index === index)?.prevout;
          addInnerScriptsToVin(input);
        }
        return input;
      });
      this.hasPrevouts = true;
    } catch (error) {
      this.errorPrevouts = error.message;
    }
  }

  processTransaction(tx: Transaction): void {
    this.transaction = tx;

    if (this.hasPrevouts) {
      this.transaction.fee = this.transaction.vin.some(input => input.is_coinbase)
        ? 0
        : this.transaction.vin.reduce((fee, input) => {
          return fee + (input.prevout?.value || 0);
        }, 0) - this.transaction.vout.reduce((sum, output) => sum + output.value, 0);
      this.transaction.feePerVsize = this.transaction.fee / (this.transaction.weight / 4);
    }

    this.transaction.flags = getTransactionFlags(this.transaction, null, null, null, this.stateService.network);
    this.filters = this.transaction.flags ? toFilters(this.transaction.flags).filter(f => f.txPage) : [];
    this.transaction.sigops = countSigops(this.transaction);
    if (this.transaction.sigops >= 0) {
      this.adjustedVsize = Math.max(this.transaction.weight / 4, this.transaction.sigops * 5);
    }

    this.setupGraph();
    this.setFlowEnabled();
    this.flowPrefSubscription = this.stateService.hideFlow.subscribe((hide) => {
      this.hideFlow = !!hide;
      this.setFlowEnabled();
    });
    this.setGraphSize();

    this.ETA$ = combineLatest([
      this.stateService.mempoolTxPosition$.pipe(startWith(null)),
      this.stateService.mempoolBlocks$.pipe(startWith(null)),
      this.stateService.difficultyAdjustment$.pipe(startWith(null)),
    ]).pipe(
      map(([position, mempoolBlocks, da]) => {
        return this.etaService.calculateETA(
          this.stateService.network,
          this.transaction,
          mempoolBlocks,
          position,
          da,
          null,
          null,
          null
        );
      })
    );

    this.mempoolBlocksSubscription = this.stateService.mempoolBlocks$.subscribe(() => {
      if (this.transaction) {
        this.stateService.markBlock$.next({
          txid: this.transaction.txid,
          txFeePerVSize: this.transaction.feePerVsize,
        });
      }
    });
  }

  async postTx(): Promise<string> {
    this.isLoadingBroadcast = true;
    this.errorBroadcast = null;
    return new Promise((resolve, reject) => {
      this.apiService.postTransaction$(this.pushTxForm.get('txRaw').value)
      .subscribe((result) => {
        this.isLoadingBroadcast = false;
        this.successBroadcast = true;
        resolve(result);
      },
      (error) => {
        if (typeof error.error === 'string') {
          const matchText = error.error.replace(/\\/g, '').match('"message":"(.*?)"');
          this.errorBroadcast = 'Failed to broadcast transaction, reason: ' + (matchText && matchText[1] || error.error);
        } else if (error.message) {
          this.errorBroadcast = 'Failed to broadcast transaction, reason: ' + error.message;
        }
        this.isLoadingBroadcast = false;
        reject(this.error);
      });
    });
  }

  resetState() {
    this.transaction = null;
    this.error = null;
    this.errorPrevouts = null;
    this.errorBroadcast = null;
    this.successBroadcast = false;
    this.isLoading = false;
    this.adjustedVsize = null;
    this.filters = [];
    this.hasPrevouts = false;
    this.prevoutsLoadedCount = 0;
    this.prevoutsCount = 0;
    this.stateService.markBlock$.next({});
    this.mempoolBlocksSubscription?.unsubscribe();
  }

  resetForm() {
    this.resetState();
    this.pushTxForm.reset();
  }

  @HostListener('window:resize', ['$event'])
  setGraphSize(): void {
    this.isMobile = window.innerWidth < 850;
    if (this.graphContainer?.nativeElement && this.stateService.isBrowser) {
      setTimeout(() => {
        if (this.graphContainer?.nativeElement?.clientWidth) {
          this.graphWidth = this.graphContainer.nativeElement.clientWidth;
        } else {
          setTimeout(() => { this.setGraphSize(); }, 1);
        }
      }, 1);
    } else {
      setTimeout(() => { this.setGraphSize(); }, 1);
    }
  }

  setupGraph() {
    this.maxInOut = Math.min(this.inOutLimit, Math.max(this.transaction?.vin?.length || 1, this.transaction?.vout?.length + 1 || 1));
    this.graphHeight = this.graphExpanded ? this.maxInOut * 15 : Math.min(360, this.maxInOut * 80);
  }

  toggleGraph() {
    const showFlow = !this.flowEnabled;
    this.stateService.hideFlow.next(!showFlow);
  }

  setFlowEnabled() {
    this.flowEnabled = !this.hideFlow;
  }

  expandGraph() {
    this.graphExpanded = true;
    this.graphHeight = this.maxInOut * 15;
  }

  collapseGraph() {
    this.graphExpanded = false;
    this.graphHeight = Math.min(360, this.maxInOut * 80);
  }

  onOfflineModeChange(e): void {
    this.offlineMode = !e.target.checked;
  }

  ngOnDestroy(): void {
    this.mempoolBlocksSubscription?.unsubscribe();
    this.flowPrefSubscription?.unsubscribe();
    this.stateService.markBlock$.next({});
  }

}
