import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { switchMap, catchError } from 'rxjs/operators';
import { Address, Transaction } from '@interfaces/electrs.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { ApiService } from '@app/services/api.service';
import { of, Subscription, forkJoin } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { AddressInformation } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-address-group',
  templateUrl: './address-group.component.html',
  styleUrls: ['./address-group.component.scss']
})
export class AddressGroupComponent implements OnInit, OnDestroy {
  network = '';

  balance = 0;
  confirmed = 0;
  mempool = 0;
  addresses: { [address: string]: number | null };
  addressStrings: string[] = [];
  addressInfo: { [address: string]: AddressInformation | null };
  seenTxs: { [txid: string ]: boolean } = {};
  isLoadingAddress = true;
  error: any;
  mainSubscription: Subscription;
  wsSubscription: Subscription;

  page: string[] = [];
  pageIndex: number = 1;
  itemsPerPage: number = 10;

  screenSize: 'lg' | 'md' | 'sm' = 'lg';
  digitsInfo: string = '1.8-8';

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.onResize();
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.websocketService.want(['blocks']);

    this.mainSubscription = this.route.queryParamMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.error = undefined;
          this.isLoadingAddress = true;
          this.addresses = {};
          this.addressInfo = {};
          this.balance = 0;
          
          this.addressStrings = params.get('addresses').split(',').map(address => {
            if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}$/.test(address)) {
              return address.toLowerCase();
            } else {
              return address;
            }
          });

          return forkJoin(this.addressStrings.map(address => {
            const getLiquidInfo = ((this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet') && /^([a-zA-HJ-NP-Z1-9]{26,35}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,100}|[a-km-zA-HJ-NP-Z1-9]{80})$/.test(address));
            return forkJoin([
              of(address),
              this.electrsApiService.getAddress$(address),
              (getLiquidInfo ? this.apiService.validateAddress$(address) : of(null)),
            ]);
          }));
        }),
        catchError(e => {
          this.error = e;
          return of([]);
        })
      ).subscribe((addresses) => {
        for (const addressData of addresses) {
          const address = addressData[0];
          const addressBalance = addressData[1] as Address;
          if (addressBalance) {
            this.addresses[address] = addressBalance.chain_stats.funded_txo_sum
              + addressBalance.mempool_stats.funded_txo_sum
              - addressBalance.chain_stats.spent_txo_sum
              - addressBalance.mempool_stats.spent_txo_sum;
            this.balance += this.addresses[address];
            this.confirmed += (addressBalance.chain_stats.funded_txo_sum - addressBalance.chain_stats.spent_txo_sum);
          }
          this.addressInfo[address] = addressData[2] ? addressData[2] as AddressInformation : null;
        }
        this.websocketService.startTrackAddresses(this.addressStrings);
        this.isLoadingAddress = false;
        this.pageChange(this.pageIndex);
      });

    this.wsSubscription = this.stateService.multiAddressTransactions$.subscribe(update => {
      for (const address of Object.keys(update)) {
        for (const tx of update[address].mempool) {
          this.addTransaction(tx, false, false);
        }
        for (const tx of update[address].confirmed) {
          this.addTransaction(tx, true, false);
        }
        for (const tx of update[address].removed) {
          this.removeTransaction(tx, tx.status.confirmed);
        }
      }
    });
  }

  pageChange(index): void {
    this.page = this.addressStrings.slice((index - 1) * this.itemsPerPage, index * this.itemsPerPage);
  }

  addTransaction(transaction: Transaction, confirmed = false, playSound: boolean = true): boolean {
    if (this.seenTxs[transaction.txid]) {
      this.removeTransaction(transaction, false);
    }
    this.seenTxs[transaction.txid] = true;

    let balance = 0;
    transaction.vin.forEach((vin) => {
      if (this.addressStrings.includes(vin?.prevout?.scriptpubkey_address)) {
        this.addresses[vin?.prevout?.scriptpubkey_address] -= vin.prevout.value;
        balance -= vin.prevout.value;
        this.balance -= vin.prevout.value;
        if (confirmed) {
          this.confirmed -= vin.prevout.value;
        }
      }
    });
    transaction.vout.forEach((vout) => {
      if (this.addressStrings.includes(vout?.scriptpubkey_address)) {
        this.addresses[vout?.scriptpubkey_address] += vout.value;
        balance += vout.value;
        this.balance += vout.value;
        if (confirmed) {
          this.confirmed += vout.value;
        }
      }
    });

    if (playSound) {
      if (balance > 0) {
        this.audioService.playSound('cha-ching');
      } else {
        this.audioService.playSound('chime');
      }
    }

    return true;
  }

  removeTransaction(transaction: Transaction, confirmed = false): boolean {
    transaction.vin.forEach((vin) => {
      if (this.addressStrings.includes(vin?.prevout?.scriptpubkey_address)) {
        this.addresses[vin?.prevout?.scriptpubkey_address] += vin.prevout.value;
        this.balance += vin.prevout.value;
        if (confirmed) {
          this.confirmed += vin.prevout.value;
        }
      }
    });
    transaction.vout.forEach((vout) => {
      if (this.addressStrings.includes(vout?.scriptpubkey_address)) {
        this.addresses[vout?.scriptpubkey_address] -= vout.value;
        this.balance -= vout.value;
        if (confirmed) {
          this.confirmed -= vout.value;
        }
      }
    });

    return true;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 992) {
      this.screenSize = 'lg';
      this.digitsInfo = '1.8-8';
    } else if (window.innerWidth >= 528) {
      this.screenSize = 'md';
      this.digitsInfo = '1.4-4';
    } else {
      this.screenSize = 'sm';
      this.digitsInfo = '1.2-2';
    }
    const newItemsPerPage = Math.floor((window.innerHeight - 150) / 30);
    if (newItemsPerPage !== this.itemsPerPage) {
      this.itemsPerPage = newItemsPerPage;
      this.pageIndex = 1;
      this.pageChange(this.pageIndex);
    }
  }

  ngOnDestroy(): void {
    this.mainSubscription.unsubscribe();
    this.wsSubscription.unsubscribe();
    this.websocketService.stopTrackingAddresses();
  }
}
