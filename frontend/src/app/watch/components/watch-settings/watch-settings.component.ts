import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, TemplateRef, ViewChild } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { StateService } from '@app/services/state.service';
import { DEFAULT_GAP_LIMIT, MAX_GAP_LIMIT, MIN_GAP_LIMIT, WalletSessionService } from '@app/watch/services/wallet-session.service';
import { accountPath } from '@app/watch/wallet-math';
import { BARE_KEY_SCRIPT_OPTIONS, multisigName, scriptTypeName } from '@app/watch/script-type-name';
import { describeScriptType, isBareExtendedKey, isBareKeyScriptType } from '@app/watch/watch-key.utils';
import { DescriptorWallet, ScriptType, WatchWallet } from '@app/watch/watch.types';

@Component({
  selector: 'app-watch-settings',
  templateUrl: './watch-settings.component.html',
  styleUrls: ['./watch-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
/** Works from the saved record alone, so a wallet whose history failed to load can still be managed. */
export class WatchSettingsComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) wallet!: WatchWallet;
  @Input() scanning = false;
  @Output() forgotten = new EventEmitter<void>();
  @ViewChild('renameInput') renameInput?: ElementRef<HTMLInputElement>;

  readonly minGapLimit = MIN_GAP_LIMIT;
  readonly maxGapLimit = MAX_GAP_LIMIT;
  readonly scriptTypes = BARE_KEY_SCRIPT_OPTIONS;
  private forgetModal: NgbModalRef | null = null;

  descriptorWallet: DescriptorWallet | null = null;
  addressListText = '';
  editingLabel = false;
  labelDraft = '';
  gapLimit = DEFAULT_GAP_LIMIT;
  scriptType = { name: '', code: '' };
  path: string | undefined;
  scriptTypeChangeable = false;
  scriptTypeDraft: ScriptType | null = null;
  networkName = '';

  constructor(
    private session: WalletSessionService,
    private stateService: StateService,
    private modalService: NgbModal,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const previous = changes.wallet?.previousValue as WatchWallet | undefined;
    if (previous !== this.wallet) {
      const wallet = this.wallet;
      this.descriptorWallet = wallet.kind === 'descriptor' ? wallet : null;
      if (this.descriptorWallet) {
        this.gapLimit = this.descriptorWallet.gapLimit;
        const { scriptType: type, multisig } = this.descriptorWallet;
        this.scriptType = {
          name: multisig ? multisigName(multisig.threshold, multisig.keys.length) : scriptTypeName(type),
          code: describeScriptType(type).code,
        };
        this.scriptTypeChangeable = isBareExtendedKey(this.descriptorWallet.source);
        this.scriptTypeDraft = isBareKeyScriptType(type) ? type : null;
      }
      this.addressListText = wallet.kind === 'address-list' ? wallet.addresses.map((a) => a.address).join('\n') : '';
      this.path = accountPath(wallet);
      this.networkName = this.stateService.networkDisplayName;
      if (previous?.id !== wallet.id) {
        this.editingLabel = false;
        this.forgetModal?.dismiss();
      }
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  startRename(): void {
    this.labelDraft = this.wallet.label;
    this.editingLabel = true;
    // The input only exists once *ngIf has rendered it.
    setTimeout(() => this.renameInput?.nativeElement.focus());
  }

  saveRename(): void {
    this.session.rename(this.labelDraft);
    this.editingLabel = false;
  }

  get gapLimitInvalid(): boolean {
    const value = Number(this.gapLimit);
    return !Number.isInteger(value) || value < MIN_GAP_LIMIT || value > MAX_GAP_LIMIT;
  }

  get gapLimitChanged(): boolean {
    return !this.gapLimitInvalid && Number(this.gapLimit) !== this.descriptorWallet?.gapLimit;
  }

  applyGapLimit(): void {
    this.session.setGapLimit(this.gapLimit);
  }

  applyScriptType(): void {
    if (this.scriptTypeDraft) {
      this.session.changeScriptType(this.scriptTypeDraft);
    }
  }

  confirmForget(dialog: TemplateRef<unknown>): void {
    this.forgetModal = this.modalService.open(dialog, { centered: true, ariaLabelledBy: 'watch-forget-title', windowClass: 'watch-forget-dialog' });
    this.forgetModal.result.then(() => this.forget(), () => null).finally(() => (this.forgetModal = null));
  }

  forget(): void {
    this.session.forget();
    this.forgotten.emit();
  }

  ngOnDestroy(): void {
    this.forgetModal?.dismiss();
  }
}
