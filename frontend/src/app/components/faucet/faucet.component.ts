import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ValidationErrors, Validators } from "@angular/forms";
import { StorageService } from '../../services/storage.service';
import { ServicesApiServices } from '../../services/services-api.service';
import { AudioService } from '../../services/audio.service';
import { StateService } from '../../services/state.service';
import { Subscription, tap } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { getRegex } from "../../shared/regex.utils";
import { WebsocketService } from "../../services/websocket.service";

@Component({
  selector: 'app-faucet',
  templateUrl: './faucet.component.html',
  styleUrls: ['./faucet.component.scss']
})
export class FaucetComponent implements OnInit, OnDestroy {
  user: any;
  loading: boolean = true;
  status: {
    access: boolean
    min: number,
    user_max: number,
    user_requests: number,
  } | null = null;
  error = '';
  faucetForm: FormGroup;
  txid = '';
  recycleAddress = this.stateService.env.TESTNET4_FAUCET_ADDRESS || 'tb1q548z58kqvwyjqwy8vc2ntmg33d7s2wyfv7ukq4';

  mempoolPositionSubscription: Subscription;
  confirmationSubscription: Subscription;

  constructor(
    private stateService: StateService,
    private storageService: StorageService,
    private servicesApiService: ServicesApiServices,
    private websocketService: WebsocketService,
    private audioService: AudioService,
    private formBuilder: FormBuilder,
  ) {
  }

  ngOnInit(): void {
    this.user = this.storageService.getAuth()?.user ?? null;
    console.log(this.user);
    if (this.user) {
      this.servicesApiService.getFaucetStatus$().subscribe(status => {
        this.status = status;
        this.initForm(this.status.min, this.status.user_max);
      })
    } else {
      this.status = {
        access: false,
        min: 5000,
        user_max: 500000,
        user_requests: 1,
      }
      this.initForm(5000, 500000);
    }

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

  initForm(min: number, max: number): void {
    this.faucetForm = this.formBuilder.group({
      'address': ['', [Validators.required, Validators.pattern(getRegex('address', 'testnet4'))]],
      'satoshis': ['', [Validators.required, Validators.min(min), Validators.max(max)]]
    }, { validators: (formGroup): ValidationErrors | null => {
      if (!this.status?.user_requests) {
        return { customError: 'You have used the faucet too many times already! Come back later.'}
      }
      return null;
    }});
    this.faucetForm.get('satoshis').setValue(min);
    this.loading = false;
  }

  setAmount(value: number): void {
    if (this.faucetForm) {
      this.faucetForm.get('satoshis').setValue(value);
    }
  }

  requestCoins(): void {
    this.error = null;
    this.stateService.markBlock$.next({});
    this.servicesApiService.requestTestnet4Coins$(this.faucetForm.get('address')?.value, parseInt(this.faucetForm.get('satoshis')?.value))
    .subscribe({
      next: ((response) => {
        this.txid = response.txid;
        this.websocketService.startTrackTransaction(this.txid);
        this.audioService.playSound('cha-ching');
      }),
      error: (response: HttpErrorResponse) => {
        this.error = response.error;
      },
    });
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
    this.websocketService.stopTrackingTransaction();
    if (this.mempoolPositionSubscription) {
      this.mempoolPositionSubscription.unsubscribe();
    }
    if (this.confirmationSubscription) {
      this.confirmationSubscription.unsubscribe();
    }
  }

  get amount() { return this.faucetForm.get('satoshis')!; }
  get address() { return this.faucetForm.get('address')!; }
  get invalidAmount() {
    const amount = this.faucetForm.get('satoshis')!;
    return amount?.invalid && (amount.dirty || amount.touched)
  }
  get invalidAddress() {
    const address = this.faucetForm.get('address')!;
    return address?.invalid && (address.dirty || address.touched)
  }
}
