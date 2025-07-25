import { Component, OnInit, HostListener, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { BytesPipe } from '@app/shared/pipes/bytes-pipe/bytes.pipe';
import { VbytesPipe } from '@app/shared/pipes/bytes-pipe/vbytes.pipe';
import { WuBytesPipe } from '@app/shared/pipes/bytes-pipe/wubytes.pipe';
import { Transaction, Vout } from '@interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';
import { Filter, toFilters } from '@app/shared/filters.utils';
import { decodeRawTransaction, getTransactionFlags, addInnerScriptsToVin, countSigops, fillUnsignedInput } from '@app/shared/transaction.utils';
import { catchError, firstValueFrom, Subscription, switchMap, tap, throwError, timer } from 'rxjs';
import { WebsocketService } from '@app/services/websocket.service';
import { ActivatedRoute, Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { ApiService } from '@app/services/api.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { CpfpInfo } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-transaction-raw',
  templateUrl: './transaction-raw.component.html',
  styleUrls: ['./transaction-raw.component.scss'],
})
export class TransactionRawComponent implements OnInit, OnDestroy {

  pushTxForm: UntypedFormGroup;
  rawHexTransaction: string;
  psbt: string;
  isLoading: boolean;
  isLoadingPrevouts: boolean;
  isLoadingCpfpInfo: boolean;
  offlineMode: boolean = false;
  transaction: Transaction;
  error: string;
  errorPrevouts: string;
  errorCpfpInfo: string;
  hasPrevouts: boolean;
  missingPrevouts: string[];
  isLoadingBroadcast: boolean;
  errorBroadcast: string;
  successBroadcast: boolean;
  isCoinbase: boolean;
  broadcastSubscription: Subscription;
  fragmentSubscription: Subscription;
  weightFromMissingSig: number = 0;
  sizeFromMissingSig: number = 0;
  missingSignatures: boolean;
  tooltipSize: string;
  tooltipVsize: string;
  tooltipWeight: string;

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
  hasEffectiveFeeRate: boolean;
  fetchCpfp: boolean;
  cpfpInfo: CpfpInfo | null;
  hasCpfp: boolean = false;
  showCpfpDetails = false;
  mempoolBlocksSubscription: Subscription;

  constructor(
    public route: ActivatedRoute,
    public router: Router,
    public stateService: StateService,
    public electrsApi: ElectrsApiService,
    public websocketService: WebsocketService,
    public formBuilder: UntypedFormBuilder,
    public seoService: SeoService,
    public apiService: ApiService,
    public relativeUrlPipe: RelativeUrlPipe,
    public bytesPipe: BytesPipe,
    public vbytesPipe: VbytesPipe,
    public wuBytesPipe: WuBytesPipe,
  ) {}

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@meta.title.preview-tx:Preview Transaction`);
    this.seoService.setDescription($localize`:@@meta.description.preview-tx:Preview a transaction to the Bitcoin${seoDescriptionNetwork(this.stateService.network)} network using the transaction's raw hex data.`);
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.pushTxForm = this.formBuilder.group({
      txRaw: ['', Validators.required],
    });

    this.fragmentSubscription = this.route.fragment.subscribe((fragment) => {
      if (fragment) {
        const params = new URLSearchParams(fragment);
        const txData = params.get('tx');
        if (txData) {
          this.pushTxForm.get('txRaw').setValue(txData);
        }
        const offline = params.get('offline');
        if (offline) {
          this.offlineMode = offline === 'true';
        }
        if (txData && this.pushTxForm.get('txRaw').value && !this.transaction) {
          this.decodeTransaction();
        }
      }
    });
  }

  async decodeTransaction(): Promise<void> {
    this.resetState();
    this.isLoading = true;
    try {
      const { tx, hex, psbt } = decodeRawTransaction(this.pushTxForm.get('txRaw').value.trim(), this.stateService.network);
      await this.fetchPrevouts(tx);
      this.checkSignatures(tx, hex);
      await this.fetchCpfpInfo(tx);
      this.processTransaction(tx, hex, psbt);
    } catch (error) {
      this.error = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  async fetchPrevouts(transaction: Transaction): Promise<void> {
    const prevoutsToFetch = transaction.vin.filter(input => !input.prevout).map((input) => ({ txid: input.txid, vout: input.vout }));

    if (!prevoutsToFetch.length || transaction.vin[0].is_coinbase || this.offlineMode) {
      this.hasPrevouts = !prevoutsToFetch.length || transaction.vin[0].is_coinbase;
      this.fetchCpfp = this.hasPrevouts && !this.offlineMode;
    } else {
      try {
        this.missingPrevouts = [];
        this.isLoadingPrevouts = true;

        const prevouts: { prevout: Vout, unconfirmed: boolean }[] = await firstValueFrom(this.apiService.getPrevouts$(prevoutsToFetch));

        if (prevouts?.length !== prevoutsToFetch.length) {
          throw new Error();
        }

        let fetchIndex = 0;
        transaction.vin.forEach(input => {
          if (!input.prevout) {
            const fetched = prevouts[fetchIndex];
            if (fetched) {
              input.prevout = fetched.prevout;
            } else {
              this.missingPrevouts.push(`${input.txid}:${input.vout}`);
            }
            fetchIndex++;
          }
        });

        if (this.missingPrevouts.length) {
          throw new Error(`Some prevouts do not exist or are already spent (${this.missingPrevouts.length})`);
        }

        this.hasPrevouts = true;
        this.isLoadingPrevouts = false;
        this.fetchCpfp = prevouts.some(prevout => prevout?.unconfirmed);
      } catch (error) {
        console.log(error);
        this.errorPrevouts = error?.error?.error || error?.message;
        this.isLoadingPrevouts = false;
      }
    }
  }

  checkSignatures(transaction: Transaction, hex: string): void {
    let missingWitnessBytes = 0;
    let missingNonWitnessBytes = 0;

    let isSegwitTransaction = hex.substring(8, 10) === '00' && hex.substring(10, 12) === '01';
    let segwitFlagSet = false;

    transaction.vin.forEach(vin => {
      addInnerScriptsToVin(vin);
      const result = fillUnsignedInput(vin);
      vin['_missingSigs'] = result.missingSigs;
      if (result.addToWitness) {
        missingWitnessBytes += result.bytes;
      } else {
        missingNonWitnessBytes += result.bytes;
      }
      if (!isSegwitTransaction && result.addToWitness) {
        segwitFlagSet = true;
        isSegwitTransaction = true;
      }
    });

    if (segwitFlagSet) { // we just added witness to a legacy transaction: need to add weight corresponding to segwit flag and compact sizes
      missingWitnessBytes += 2; // marker and flag
      missingWitnessBytes += transaction.vin.length; // 1 byte compact size per input (assume witness stack count < 253)
    }

    this.sizeFromMissingSig = missingWitnessBytes + missingNonWitnessBytes;
    this.weightFromMissingSig = missingWitnessBytes + 4 * missingNonWitnessBytes;

    if (this.weightFromMissingSig) {
      this.tooltipSize = `Includes ${this.bytesPipe.transform(this.sizeFromMissingSig, 2, undefined, undefined, true)} added for missing signatures`;
      this.tooltipVsize = `Includes ${this.vbytesPipe.transform(this.weightFromMissingSig / 4, 2, undefined, undefined, true)} added for missing signatures`;
      this.tooltipWeight = `Includes ${this.wuBytesPipe.transform(this.weightFromMissingSig, 2, undefined, undefined, true)} added for missing signatures`;
    }

    this.missingSignatures = transaction.vin.some(input => input['_missingSigs'] > 0);

    if (this.hasPrevouts) {
      transaction.fee = transaction.vin.some(input => input.is_coinbase)
        ? 0
        : transaction.vin.reduce((fee, input) => {
          return fee + (input.prevout?.value || 0);
        }, 0) - transaction.vout.reduce((sum, output) => sum + output.value, 0);
      transaction.feePerVsize = transaction.fee / ((transaction.weight + this.weightFromMissingSig) / 4);
      transaction.sigops = countSigops(transaction);
      this.adjustedVsize = Math.max((transaction.weight + this.weightFromMissingSig) / 4, transaction.sigops * 5);
      const adjustedFeePerVsize = transaction.fee / this.adjustedVsize;
      if (adjustedFeePerVsize !== transaction.feePerVsize) {
        transaction.effectiveFeePerVsize = adjustedFeePerVsize;
        this.cpfpInfo = { ancestors: [], effectiveFeePerVsize: adjustedFeePerVsize };
        this.hasEffectiveFeeRate = true;
      }
    }
  }

  async fetchCpfpInfo(transaction: Transaction): Promise<void> {
    // Fetch potential cpfp data if all prevouts were parsed successfully and at least one of them is unconfirmed
    if (this.hasPrevouts && this.fetchCpfp) {
      try {
        this.isLoadingCpfpInfo = true;
        const cpfpInfo: CpfpInfo[] = await firstValueFrom(this.apiService.getCpfpLocalTx$([{
          txid: transaction.txid,
          weight: transaction.weight + this.weightFromMissingSig,
          sigops: transaction.sigops,
          fee: transaction.fee,
          vin: transaction.vin,
          vout: transaction.vout
        }]));

        if (cpfpInfo?.[0]?.ancestors?.length) {
          const { ancestors, effectiveFeePerVsize } = cpfpInfo[0];
          transaction.effectiveFeePerVsize = effectiveFeePerVsize;
          this.cpfpInfo = { ancestors, effectiveFeePerVsize };
          this.hasCpfp = true;
          this.hasEffectiveFeeRate = true;
        }
        this.isLoadingCpfpInfo = false;
      } catch (error) {
        this.errorCpfpInfo = error?.error?.error || error?.message;
        this.isLoadingCpfpInfo = false;
      }
    }
  }

  processTransaction(tx: Transaction, hex: string, psbt: string): void {
    this.transaction = tx;
    this.rawHexTransaction = hex;
    this.psbt = psbt;

    this.isCoinbase = this.transaction.vin[0].is_coinbase;

    // Update URL fragment with hex or psbt data
    this.router.navigate([], {
      fragment: this.getCurrentFragments(),
      replaceUrl: true
    });

    const txHeight = this.transaction.status?.block_height || (this.stateService.latestBlockHeight >= 0 ? this.stateService.latestBlockHeight + 1 : null);
    this.transaction.flags = getTransactionFlags(this.transaction, this.cpfpInfo, null, txHeight, this.stateService.network);
    this.filters = this.transaction.flags ? toFilters(this.transaction.flags).filter(f => f.txPage) : [];

    this.setupGraph();
    this.setFlowEnabled();
    this.flowPrefSubscription = this.stateService.hideFlow.subscribe((hide) => {
      this.hideFlow = !!hide;
      this.setFlowEnabled();
    });
    this.setGraphSize();

    this.mempoolBlocksSubscription = this.stateService.mempoolBlocks$.subscribe(() => {
      if (this.transaction) {
        this.stateService.markBlock$.next({
          txid: this.transaction.txid,
          txFeePerVSize: this.transaction.effectiveFeePerVsize || this.transaction.feePerVsize,
        });
      }
    });
  }

  postTx(): void {
    this.isLoadingBroadcast = true;
    this.errorBroadcast = null;

    this.broadcastSubscription = this.apiService.postTransaction$(this.rawHexTransaction).pipe(
      tap((txid: string) => {
        this.isLoadingBroadcast = false;
        this.successBroadcast = true;
        this.transaction.txid = txid;
      }),
      switchMap((txid: string) =>
        timer(2000).pipe(
          tap(() => this.router.navigate([this.relativeUrlPipe.transform('/tx/' + txid)])),
        )
      ),
      catchError((error) => {
        if (typeof error.error === 'string') {
          const matchText = error.error.replace(/\\/g, '').match('"message":"(.*?)"');
          this.errorBroadcast = 'Failed to broadcast transaction, reason: ' + (matchText && matchText[1] || error.error);
        } else if (error.message) {
          this.errorBroadcast = 'Failed to broadcast transaction, reason: ' + error.message;
        }
        this.isLoadingBroadcast = false;
        return throwError(() => error);
      })
    ).subscribe();
  }

  resetState() {
    this.transaction = null;
    this.rawHexTransaction = null;
    this.psbt = null;
    this.error = null;
    this.errorPrevouts = null;
    this.errorBroadcast = null;
    this.successBroadcast = false;
    this.isLoading = false;
    this.isLoadingPrevouts = false;
    this.isLoadingCpfpInfo = false;
    this.isLoadingBroadcast = false;
    this.adjustedVsize = null;
    this.showCpfpDetails = false;
    this.hasCpfp = false;
    this.fetchCpfp = false;
    this.cpfpInfo = null;
    this.hasEffectiveFeeRate = false;
    this.filters = [];
    this.hasPrevouts = false;
    this.missingPrevouts = [];
    this.weightFromMissingSig = 0;
    this.sizeFromMissingSig = 0;
    this.missingSignatures = false;
    this.tooltipSize = null;
    this.tooltipVsize = null;
    this.tooltipWeight = null;
    this.stateService.markBlock$.next({});
    this.mempoolBlocksSubscription?.unsubscribe();
    this.broadcastSubscription?.unsubscribe();
  }

  resetForm() {
    this.resetState();
    this.pushTxForm.get('txRaw').setValue('');
    this.offlineMode = false;
    this.router.navigate([], {
      fragment: '',
      replaceUrl: true
    });
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

  getCurrentFragments() {
    // build a fragment param string from current state
    const params = new URLSearchParams();
    if (this.offlineMode) {
      params.set('offline', 'true');
    }
    if (this.rawHexTransaction) {
      params.set('tx', this.psbt || this.rawHexTransaction); // use PSBT in fragment if available
    }
    return params.toString();
  }

  onOfflineModeChange(e): void {
    this.offlineMode = !e.target.checked;
    this.router.navigate([], {
      fragment: this.getCurrentFragments(),
      replaceUrl: true
    });
  }

  ngOnDestroy(): void {
    this.mempoolBlocksSubscription?.unsubscribe();
    this.flowPrefSubscription?.unsubscribe();
    this.stateService.markBlock$.next({});
    this.broadcastSubscription?.unsubscribe();
    this.fragmentSubscription?.unsubscribe();
  }

}
