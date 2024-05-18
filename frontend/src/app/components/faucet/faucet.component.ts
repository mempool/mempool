import { Component, OnDestroy, OnInit, ChangeDetectorRef } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Subscription } from "rxjs";
import { StorageService } from "../../services/storage.service";
import { ServicesApiServices } from "../../services/services-api.service";
import { getRegex } from "../../shared/regex.utils";
import { StateService } from "../../services/state.service";
import { WebsocketService } from "../../services/websocket.service";
import { AudioService } from "../../services/audio.service";
import { HttpErrorResponse } from "@angular/common/http";

@Component({
  selector: 'app-faucet',
  templateUrl: './faucet.component.html',
  styleUrls: ['./faucet.component.scss']
})
export class FaucetComponent implements OnInit, OnDestroy {
  loading = true;
  error: string = '';
  user: any = undefined;
  txid: string = '';
 
  faucetStatusSubscription: Subscription;
  status: {
    min: number; // minimum amount to request at once (in sats)
    max: number; // maximum amount to request at once
    address?: string; // faucet address
    code: 'ok' | 'faucet_not_available' | 'faucet_maximum_reached' | 'faucet_too_soon';
  } | null = null;
  faucetForm: FormGroup;

  mempoolPositionSubscription: Subscription;
  confirmationSubscription: Subscription;

  constructor(
    private cd: ChangeDetectorRef,
    private storageService: StorageService,
    private servicesApiService: ServicesApiServices,
    private formBuilder: FormBuilder,
    private stateService: StateService,
    private websocketService: WebsocketService,
    private audioService: AudioService
  ) {
    this.faucetForm = this.formBuilder.group({
      'address': ['', [Validators.required, Validators.pattern(getRegex('address', 'testnet4'))]],
      'satoshis': [0, [Validators.required, Validators.min(0), Validators.max(0)]]
    });
  }

  ngOnDestroy() {
    this.stateService.markBlock$.next({});
    this.websocketService.stopTrackingTransaction();
    if (this.mempoolPositionSubscription) {
      this.mempoolPositionSubscription.unsubscribe();
    }
    if (this.confirmationSubscription) {
      this.confirmationSubscription.unsubscribe();
    }
  }

  ngOnInit() {
    this.user = this.storageService.getAuth()?.user ?? null;
    if (!this.user) {
      this.loading = false;
      return;
    }

    // Setup form
    this.faucetStatusSubscription = this.servicesApiService.getFaucetStatus$().subscribe({
      next: (status) => {
        if (!status) {
          this.error = 'internal_server_error';
          return;
        }
        this.status = status;

        this.faucetForm = this.formBuilder.group({
          'address': ['', [Validators.required, Validators.pattern(getRegex('address', 'testnet4'))]],
          'satoshis': [this.status.min, [Validators.required, Validators.min(this.status.min), Validators.max(this.status.max)]]
        });

        if (this.status.code !== 'ok') {
          this.error = this.status.code;
        }

        this.loading = false;
        this.cd.markForCheck();
      },
      error: (response) => {
        this.loading = false;
        this.error = response.error;
        this.cd.markForCheck();
      }
    });

    // Track transaction
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.mempoolPositionSubscription = this.stateService.mempoolTxPosition$.subscribe(txPosition => {
      if (txPosition && txPosition.txid === this.txid) {
        this.stateService.markBlock$.next({
          txid: txPosition.txid,
          mempoolPosition: txPosition.position,
        });
      }
    });

    this.confirmationSubscription = this.stateService.txConfirmed$.subscribe(([txConfirmed, block]) => {
      if (txConfirmed && txConfirmed === this.txid) {
        this.stateService.markBlock$.next({ blockHeight: block.height });
      }
    });
  }

  requestCoins(): void {
    this.error = null;
    this.txid = '';
    this.stateService.markBlock$.next({});
    this.servicesApiService.requestTestnet4Coins$(this.faucetForm.get('address')?.value, parseInt(this.faucetForm.get('satoshis')?.value))
    .subscribe({
      next: ((response) => {
        this.txid = response.txid;
        this.websocketService.startTrackTransaction(this.txid);
        this.audioService.playSound('cha-ching');
        this.cd.markForCheck();
      }),
      error: (response: HttpErrorResponse) => {
        this.error = response.error;
      },
    });
  }

  setAmount(value: number): void {
    if (this.faucetForm) {
      this.faucetForm.get('satoshis').setValue(value);
    }
  }

  get amount() { return this.faucetForm.get('satoshis')!; }
  get invalidAmount() {
    const amount = this.faucetForm.get('satoshis')!;
    return amount?.invalid && (amount.dirty || amount.touched)
  }

  get address() { return this.faucetForm.get('address')!; }
  get invalidAddress() {
    const address = this.faucetForm.get('address')!;
    return address?.invalid && (address.dirty || address.touched)
  }
}
