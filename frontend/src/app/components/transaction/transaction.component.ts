import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, filter, catchError, retryWhen, delay } from 'rxjs/operators';
import { Transaction, Block } from '../../interfaces/electrs.interface';
import { of, merge, Subscription, Observable, Subject } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { AudioService } from 'src/app/services/audio.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { CpfpInfo } from 'src/app/interfaces/node-api.interface';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss'],
})
export class TransactionComponent implements OnInit, OnDestroy {
  network = '';
  tx: Transaction;
  txId: string;
  txInBlockIndex: number;
  isLoadingTx = true;
  error: any = undefined;
  errorUnblinded: any = undefined;
  waitingForTransaction = false;
  latestBlock: Block;
  transactionTime = -1;
  subscription: Subscription;
  fetchCpfpSubscription: Subscription;
  rbfTransaction: undefined | Transaction;
  cpfpInfo: CpfpInfo | null;
  showCpfpDetails = false;
  fetchCpfp$ = new Subject<string>();
  commitments: Map<any, any>;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private websocketService: WebsocketService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService
  ) {}

  ngOnInit() {
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.stateService.networkChanged$.subscribe(network => (this.network = network));

    this.fetchCpfpSubscription = this.fetchCpfp$
      .pipe(switchMap(txId => this.apiService.getCpfpinfo$(txId).pipe(retryWhen(errors => errors.pipe(delay(2000))))))
      .subscribe(cpfpInfo => {
        if (!this.tx) {
          return;
        }
        const lowerFeeParents = cpfpInfo.ancestors.filter(
          parent => parent.fee / (parent.weight / 4) < this.tx.feePerVsize
        );
        let totalWeight = this.tx.weight + lowerFeeParents.reduce((prev, val) => prev + val.weight, 0);
        let totalFees = this.tx.fee + lowerFeeParents.reduce((prev, val) => prev + val.fee, 0);

        if (cpfpInfo.bestDescendant) {
          totalWeight += cpfpInfo.bestDescendant.weight;
          totalFees += cpfpInfo.bestDescendant.fee;
        }

        this.tx.effectiveFeePerVsize = totalFees / (totalWeight / 4);
        this.stateService.markBlock$.next({
          txFeePerVSize: this.tx.effectiveFeePerVsize,
        });
        this.cpfpInfo = cpfpInfo;
      });

    this.subscription = this.route.paramMap
      .pipe(
        switchMap(async (params: ParamMap) => {
          this.txId = params.get('id') || '';

          await this.checkUnblindedTx();
          this.seoService.setTitle(
            $localize`:@@bisq.transaction.browser-title:Transaction: ${this.txId}:INTERPOLATION:`
          );
          this.resetTransaction();
          return merge(
            of(true),
            this.stateService.connectionState$.pipe(
              filter(state => state === 2 && this.tx && !this.tx.status.confirmed)
            )
          );
        }),
        switchMap(() => {
          let transactionObservable$: Observable<Transaction>;
          if (history.state.data) {
            transactionObservable$ = of(history.state.data);
          } else {
            transactionObservable$ = this.electrsApiService
              .getTransaction$(this.txId)
              .pipe(catchError(this.handleLoadElectrsTransactionError.bind(this)));
          }
          return merge(transactionObservable$, this.stateService.mempoolTransactions$);
        })
      )
      .subscribe(
        async (tx: Transaction) => {
          if (!tx) {
            return;
          }
          this.tx = tx;
          if (tx.fee === undefined) {
            this.tx.fee = 0;
          }
          this.tx.feePerVsize = tx.fee / (tx.weight / 4);
          this.isLoadingTx = false;
          this.error = undefined;
          this.waitingForTransaction = false;
          this.setMempoolBlocksSubscription();

          if (!tx.status.confirmed) {
            this.websocketService.startTrackTransaction(tx.txid);

            if (tx.firstSeen) {
              this.transactionTime = tx.firstSeen;
            } else {
              this.getTransactionTime();
            }
          }

          if (this.tx.status.confirmed) {
            this.stateService.markBlock$.next({
              blockHeight: tx.status.block_height,
            });
          } else {
            if (tx.cpfpChecked) {
              this.stateService.markBlock$.next({
                txFeePerVSize: tx.effectiveFeePerVsize,
              });
              this.cpfpInfo = {
                ancestors: tx.ancestors,
                bestDescendant: tx.bestDescendant,
              };
            } else {
              this.fetchCpfp$.next(this.tx.txid);
            }
          }
          await this.checkUnblindedTx();
        },
        error => {
          this.error = error;
          this.isLoadingTx = false;
        }
      );

    this.stateService.blocks$.subscribe(([block, txConfirmed]) => {
      this.latestBlock = block;

      if (txConfirmed && this.tx) {
        this.tx.status = {
          confirmed: true,
          block_height: block.height,
          block_hash: block.id,
          block_time: block.timestamp,
        };
        this.stateService.markBlock$.next({ blockHeight: block.height });
        this.audioService.playSound('magic');
      }
    });

    this.stateService.txReplaced$.subscribe(rbfTransaction => (this.rbfTransaction = rbfTransaction));
  }

  handleLoadElectrsTransactionError(error: any): Observable<any> {
    if (error.status === 404 && /^[a-fA-F0-9]{64}$/.test(this.txId)) {
      this.websocketService.startMultiTrackTransaction(this.txId);
      this.waitingForTransaction = true;
    }
    this.error = error;
    this.isLoadingTx = false;
    return of(false);
  }

  setMempoolBlocksSubscription() {
    this.stateService.mempoolBlocks$.subscribe(mempoolBlocks => {
      if (!this.tx) {
        return;
      }

      const txFeePerVSize = this.tx.effectiveFeePerVsize || this.tx.fee / (this.tx.weight / 4);

      for (const block of mempoolBlocks) {
        for (let i = 0; i < block.feeRange.length - 1; i++) {
          if (txFeePerVSize <= block.feeRange[i + 1] && txFeePerVSize >= block.feeRange[i]) {
            this.txInBlockIndex = mempoolBlocks.indexOf(block);
          }
        }
      }
    });
  }

  getTransactionTime() {
    this.apiService.getTransactionTimes$([this.tx.txid]).subscribe(transactionTimes => {
      this.transactionTime = transactionTimes[0];
    });
  }

  resetTransaction() {
    this.error = undefined;
    this.tx = null;
    this.waitingForTransaction = false;
    this.isLoadingTx = true;
    this.rbfTransaction = undefined;
    this.transactionTime = -1;
    this.cpfpInfo = null;
    this.showCpfpDetails = false;
    document.body.scrollTo(0, 0);
    this.leaveTransaction();
  }

  leaveTransaction() {
    this.websocketService.stopTrackingTransaction();
    this.stateService.markBlock$.next({});
  }

  roundToOneDecimal(cpfpTx: any): number {
    return +(cpfpTx.fee / (cpfpTx.weight / 4)).toFixed(1);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.fetchCpfpSubscription.unsubscribe();
    this.leaveTransaction();
  }

  // Parse the blinders data from a string encoded as a comma separated list, in the following format:
  // <value_in_satoshis>,<asset_tag_hex>,<amount_blinder_hex>,<asset_blinder_hex>
  // This can be repeated with a comma separator to specify blinders for multiple outputs.

  parseBlinders(str: string) {
    const parts = str.split(',');
    const blinders = [];
    while (parts.length) {
      blinders.push({
        value: this.verifyNum(parts.shift()),
        asset: this.verifyHex32(parts.shift()),
        value_blinder: this.verifyHex32(parts.shift()),
        asset_blinder: this.verifyHex32(parts.shift()),
      });
    }
    return blinders;
  }

  verifyNum(num: string) {
    if (!+num) {
      throw new Error('Invalid blinding data (invalid number)');
    }
    return +num;
  }
  verifyHex32(str: string) {
    if (!str || !/^[0-9a-f]{64}$/i.test(str)) {
      throw new Error('Invalid blinding data (invalid hex)');
    }
    return str;
  }

  async makeCommitmentMap(blinders: any) {
    const libwally = await import('./libwally.js');
    await libwally.load();
    const commitments = new Map();
    blinders.forEach(b => {
      const { asset_commitment, value_commitment } = libwally.generate_commitments(
        b.value,
        b.asset,
        b.value_blinder,
        b.asset_blinder
      );

      commitments.set(`${asset_commitment}:${value_commitment}`, {
        asset: b.asset,
        value: b.value,
      });
    });
    return commitments;
  }

  // Look for the given output, returning an { value, asset } object
  find(vout: any) {
    return (
      vout.assetcommitment &&
      vout.valuecommitment &&
      this.commitments.get(`${vout.assetcommitment}:${vout.valuecommitment}`)
    );
  }

  // Lookup all transaction inputs/outputs and attach the unblinded data
  tryUnblindTx(tx: any) {
    if (tx) {
      if (tx._unblinded) {
        return tx._unblinded;
      }
      let matched = 0;
      if (tx.vout !== undefined) {
        tx.vout.forEach(vout => (matched += +this.tryUnblindOut(vout)));
        tx.vin.filter(vin => vin.prevout).forEach(vin => (matched += +this.tryUnblindOut(vin.prevout)));
      }
      if (this.commitments !== undefined) {
        tx._unblinded = { matched, total: this.commitments.size };
        this.deduceBlinded(tx);
        if (matched < this.commitments.size) {
          this.errorUnblinded = `Error: Invalid blinding data.`;
        }
        tx._deduced = false; // invalidate cache so deduction is attempted again
        return tx._unblinded;
      }
    }
  }

  // Look the given output and attach the unblinded data
  tryUnblindOut(vout: any) {
    const unblinded = this.find(vout);
    if (unblinded) {
      Object.assign(vout, unblinded);
    }
    return !!unblinded;
  }

  // Attempt to deduce the blinded input/output based on the available information
  deduceBlinded(tx: any) {
    if (tx._deduced) {
      return;
    }
    tx._deduced = true;

    // Find ins/outs with unknown amounts (blinded ant not revealed via the `#blinded` hash fragment)
    const unknownIns = tx.vin.filter(vin => vin.prevout && vin.prevout.value == null);
    const unknownOuts = tx.vout.filter(vout => vout.value == null);

    // If the transaction has a single unknown input/output, we can deduce its asset/amount
    // based on the other known inputs/outputs.
    if (unknownIns.length + unknownOuts.length === 1) {
      // Keep a per-asset tally of all known input amounts, minus all known output amounts
      const totals = new Map();
      tx.vin
        .filter(vin => vin.prevout && vin.prevout.value != null)
        .forEach(({ prevout }) => totals.set(prevout.asset, (totals.get(prevout.asset) || 0) + prevout.value));
      tx.vout
        .filter(vout => vout.value != null)
        .forEach(vout => totals.set(vout.asset, (totals.get(vout.asset) || 0) - vout.value));

      // There should only be a single asset where the inputs and outputs amounts mismatch,
      // which is the asset of the blinded input/output
      const remainder = Array.from(totals.entries()).filter(([asset, value]) => value !== 0);
      if (remainder.length !== 1) {
        throw new Error('unexpected remainder while deducing blinded tx');
      }
      const [blindedAsset, blindedValue] = remainder[0];

      // A positive remainder (when known in > known out) is the asset/amount of the unknown blinded output,
      // a negative one is the input.
      if (blindedValue > 0) {
        if (!unknownOuts.length) {
          throw new Error('expected unknown output');
        }
        unknownOuts[0].asset = blindedAsset;
        unknownOuts[0].value = blindedValue;
      } else {
        if (!unknownIns.length) {
          throw new Error('expected unknown input');
        }
        unknownIns[0].prevout.asset = blindedAsset;
        unknownIns[0].prevout.value = blindedValue * -1;
      }
    }
  }

  async checkUnblindedTx() {
    try {
      if (this.network === 'liquid') {
        const windowLocationHash = window.location.hash.substring('#blinded='.length);
        if (windowLocationHash.length > 0) {
          const blinders = this.parseBlinders(windowLocationHash);
          if (blinders) {
            this.commitments = await this.makeCommitmentMap(blinders);
            this.tryUnblindTx(this.tx);
          }
        }
      }
    } catch (error) {
      this.errorUnblinded = error;
    }
  }
}
