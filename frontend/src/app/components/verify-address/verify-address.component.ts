import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { AddressTypeInfo } from '../../shared/address-utils';
import { addressToScriptPubKey, scriptPubKeyToAddress, createMessageSigningPsbt } from '../../shared/transaction.utils';
import { Utxo } from '@interfaces/electrs.interface';
import { Recommendedfees } from '@interfaces/websocket.interface';

@Component({
  selector: 'app-verify-address',
  templateUrl: './verify-address.component.html',
  styleUrls: ['./verify-address.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyAddressComponent implements OnInit, OnDestroy {
  network: string = '';
  verifyAddressForm: UntypedFormGroup;
  addressType: AddressTypeInfo | null = null;
  showFallbackFee = false;
  generatedPsbt: string = '';
  isUpdatingFields = false;
  showQR: boolean = false;
  utxos: Utxo[] = [];
  isLoadingUtxos = false;
  isGeneratingPsbt = false;
  utxosError = '';
  selectedUtxoKey = '';
  priorityFeeRate = 0;
  generateError = '';

  private destroy$ = new Subject<void>();

  constructor(
    public stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private formBuilder: UntypedFormBuilder,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private cd: ChangeDetectorRef,
  ) {
    this.network = this.stateService.network || '';

    this.verifyAddressForm = this.formBuilder.group({
      address: ['', [this.addressValidator.bind(this)]],
      spk: ['', [Validators.required, this.hexValidator.bind(this)]],
      message: ['', [Validators.required, Validators.minLength(1)]],
      feeRate: [null, [Validators.min(0)]],
      fallbackFee: [null, [Validators.min(0)]],
      sequence: [0, [Validators.min(0), Validators.max(0xffffffff)]],
      locktime: [0, [Validators.min(0), Validators.max(0xffffffff)]],
      utxo: ['', [Validators.required]],
    });

    this.setupFieldSynchronization();
  }

  ngOnInit(): void {
    this.stateService.networkChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe((network) => {
        this.network = network;
        this.resetUtxos();
      });

    this.stateService.recommendedFees$
      .pipe(takeUntil(this.destroy$))
      .subscribe((fees: Recommendedfees) => this.priorityFeeRate = fees?.fastestFee || 0);

    this.addressControl?.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.tryFetchUtxos());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupFieldSynchronization(): void {
    this.addressControl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(address => {
        if (this.isUpdatingFields) {
          return;
        }
        this.isUpdatingFields = true;

        try {
          const normalizedAddress = (address || '').trim();
          const { scriptPubKey } = addressToScriptPubKey(normalizedAddress, this.network || '');
          if (scriptPubKey && this.spkControl?.value !== scriptPubKey) {
            this.spkControl?.setValue(scriptPubKey, { emitEvent: false });
          } else if (scriptPubKey === null) {
            this.spkControl?.setValue('', { emitEvent: false });
          }
        } catch (error) {
          console.warn('Error converting address to scriptPubKey:', error);
        } finally {
          this.isUpdatingFields = false;
        }
      });

    this.spkControl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(spk => {
        if (this.isUpdatingFields) {
          return;
        }
        this.isUpdatingFields = true;

        try {
          const normalizedSpk = (spk || '').trim();
          const { address } = scriptPubKeyToAddress(normalizedSpk, this.network || '');

          if (address && this.addressControl?.value !== address) {
            this.addressControl?.setValue(address, { emitEvent: false });
          } else if (address === null) {
            this.addressControl?.setValue('', { emitEvent: false });
          }
        } catch (error) {
          console.warn('Error converting scriptPubKey to address:', error);
        } finally {
          this.isUpdatingFields = false;
        }
      });
  }

  addressValidator(control: any) {
    if (!control.value) {
      this.addressType = null;
      this.showFallbackFee = false;
      return null;
    }

    const value = (control.value || '').trim();
    const addressTypeInfo = new AddressTypeInfo(this.network || '', value);
    this.showFallbackFee = ['p2sh', 'v0_p2wsh', 'v1_p2tr'].includes(addressTypeInfo.type);
    this.addressType = addressTypeInfo;
    if (this.addressType.type !== 'unknown') {
      return null;
    }
    this.addressType = null;
    this.showFallbackFee = false;
    return { invalidAddress: true };
  }

  hexValidator(control: any) {
    if (!control.value) {
      return { required: true };
    }

    const hexRegex = /^[0-9a-fA-F]+$/;
    const value = control.value.trim();

    if (!hexRegex.test(value) || value.length % 2 !== 0) {
      return { invalidHex: true };
    }

    return null;
  }

  get addressControl() {
    return this.verifyAddressForm.get('address');
  }

  get spkControl() {
    return this.verifyAddressForm.get('spk');
  }

  get messageControl() {
    return this.verifyAddressForm.get('message');
  }

  get feeRateControl() {
    return this.verifyAddressForm.get('feeRate');
  }

  get fallbackFeeControl() {
    return this.verifyAddressForm.get('fallbackFee');
  }

  get sequenceControl() {
    return this.verifyAddressForm.get('sequence');
  }

  get locktimeControl() {
    return this.verifyAddressForm.get('locktime');
  }

  get utxoControl() {
    return this.verifyAddressForm.get('utxo');
  }

  private tryFetchUtxos(): void {
    const address = this.addressControl?.value?.trim();
    if (!address || this.addressControl?.invalid || this.spkControl?.invalid) {
      this.resetUtxos();
      return;
    }

    this.fetchUtxos(address);
  }

  private fetchUtxos(address: string): void {
    this.isLoadingUtxos = true;
    this.utxosError = '';
    this.cd.markForCheck();

    this.electrsApiService.getAddressUtxos$(address)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (utxos: Utxo[]) => {
          this.isLoadingUtxos = false;
          this.utxos = (utxos || []).sort((a, b) => b.value - a.value);
          this.utxosError = this.utxos.length ? '' : 'This address has no UTXOs.';

          if (this.utxos.length) {
            this.selectUtxo(this.utxos[0]);
          } else {
            this.selectedUtxoKey = '';
            this.utxoControl?.reset('');
          }
          this.cd.markForCheck();
        },
        error: (error) => {
          console.error(error);
          this.isLoadingUtxos = false;
          this.utxos = [];
          this.utxosError = 'Unable to fetch UTXOs for this address: ' + (error?.message || 'Unknown error.');
          this.cd.markForCheck();
        }
      });
  }

  selectUtxo(utxo: Utxo): void {
    const key = `${utxo.txid}:${utxo.vout}`;
    this.selectedUtxoKey = key;
    this.utxoControl?.setValue(key);
    this.cd.markForCheck();
  }

  private resetUtxos(): void {
    this.utxos = [];
    this.utxosError = '';
    this.selectedUtxoKey = '';
    this.isLoadingUtxos = false;
    this.utxoControl?.reset('');
    this.cd.markForCheck();
  }

  private getSelectedUtxo(): Utxo | undefined {
    const key = this.utxoControl?.value || this.selectedUtxoKey;
    if (!key) {
      return undefined;
    }
    const [txid, voutStr] = key.split(':');
    return this.utxos.find((utxo) => utxo.txid === txid && utxo.vout === Number(voutStr));
  }

  canGenerate(): boolean {
    return !!this.addressType
      && !!this.getSelectedUtxo()
      && this.spkControl?.valid
      && this.messageControl?.valid
      && this.utxoControl?.valid
      && !this.isLoadingUtxos
      && !this.isGeneratingPsbt
  }

  async generatePsbt(): Promise<void> {
    this.generatedPsbt = '';
    this.generateError = '';
    this.isGeneratingPsbt = true;
    this.cd.markForCheck();

    try {
      const result = createMessageSigningPsbt(
        this.getSelectedUtxo(),
        this.spkControl?.value?.trim() || '',
        this.addressType.type,
        this.addressControl?.value?.trim() || '',
        this.messageControl?.value?.trim() || '',
        this.feeRateControl?.value ?? this.priorityFeeRate ?? 1,
        this.fallbackFeeControl?.value ?? 1000,
        this.sequenceControl?.value ?? 0xffffffff,
        this.locktimeControl?.value ?? 0,
        await firstValueFrom(this.electrsApiService.getTransactionHex$(this.getSelectedUtxo().txid))
      );

      this.generatedPsbt = result;
    } catch (error: any) {
      console.error(error);
      this.generateError = 'Can not build transaction' + (error?.message ? ': ' + error.message : '.');
    } finally {
      this.isGeneratingPsbt = false;
      this.cd.markForCheck();
    }
  }

  navigateToPreview(): void {
    if (!this.generatedPsbt) {
      return;
    }
    const fragment = new URLSearchParams({ offline: 'true', tx: this.generatedPsbt }).toString();
    const previewPath = this.relativeUrlPipe.transform('/tx/preview');
    const url = this.router.serializeUrl(this.router.createUrlTree([previewPath], { fragment: fragment }));
    window.open(url, '_blank');
  }

  cancel(): void {
    this.generatedPsbt = '';
    this.generateError = '';
  }
}
