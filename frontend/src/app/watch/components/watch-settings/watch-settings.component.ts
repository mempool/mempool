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
  private modal: NgbModalRef | null = null;
  /** Fixed when the popup opens: a refresh can reset the field while it is open. */
  confirming = { title: '', body: '' };

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
    // Only a new wallet resets the drafts: `scanning` changes on its own when a scan starts or ends.
    if (changes.wallet) {
      const previous = changes.wallet.previousValue as WatchWallet | undefined;
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
        this.resetScriptType();
      }
      this.addressListText = wallet.kind === 'address-list' ? wallet.addresses.map((a) => a.address).join('\n') : '';
      this.path = accountPath(wallet);
      this.networkName = this.stateService.networkDisplayName;
      if (previous?.id !== wallet.id) {
        this.editingLabel = false;
        this.modal?.dismiss();
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

  confirmGapLimit(dialog: TemplateRef<unknown>): void {
    const wallet = this.descriptorWallet;
    if (this.modal || !wallet || !this.gapLimitChanged) {
      return;
    }
    const gapLimit = Number(this.gapLimit);
    this.confirm(dialog, {
      title: $localize`:@@watch.gap-limit-dialog-title:Change the gap limit to ${gapLimit}:limit:?`,
      body: gapLimit > wallet.gapLimit
        ? $localize`:@@watch.gap-limit-dialog-body-up:The wallet is rescanned to look for addresses within the new limit.`
        : $localize`:@@watch.gap-limit-dialog-body-down:Addresses already found are kept, so no rescan is needed.`,
    }, () => this.session.setGapLimit(gapLimit), () => (this.gapLimit = this.descriptorWallet?.gapLimit ?? DEFAULT_GAP_LIMIT));
  }

  confirmScriptType(dialog: TemplateRef<unknown>): void {
    const type = this.scriptTypeDraft;
    if (this.modal || !type || type === this.descriptorWallet?.scriptType) {
      return;
    }
    const label = this.scriptTypes.find((t) => t.value === type)?.label ?? type;
    this.confirm(dialog, {
      title: $localize`:@@watch.script-type-dialog-title:Change the address type to ${label}:type:?`,
      body: $localize`:@@watch.script-type-dialog-body:The wallet is rescanned with the new address type.`,
    }, () => this.session.changeScriptType(type), () => this.resetScriptType());
  }

  /** The field only proposes a value: it applies once confirmed. Reset after a failed change too, so it never shows a value the wallet doesn't have. */
  private confirm(dialog: TemplateRef<unknown>, text: { title: string; body: string }, apply: () => Promise<void>, reset: () => void): void {
    this.confirming = text;
    this.modal = this.modalService.open(dialog, { centered: true, ariaLabelledBy: 'watch-confirm-title', windowClass: 'watch-dialog' });
    this.modal.result
      .then(apply, () => null)
      .finally(() => {
        this.modal = null;
        reset();
      });
  }

  private resetScriptType(): void {
    const type = this.descriptorWallet?.scriptType;
    this.scriptTypeDraft = type && isBareKeyScriptType(type) ? type : null;
  }

  confirmForget(dialog: TemplateRef<unknown>): void {
    this.modal = this.modalService.open(dialog, { centered: true, ariaLabelledBy: 'watch-forget-title', windowClass: 'watch-dialog' });
    this.modal.result.then(() => this.forget(), () => null).finally(() => (this.modal = null));
  }

  forget(): void {
    this.session.forget();
    this.forgotten.emit();
  }

  ngOnDestroy(): void {
    this.modal?.dismiss();
  }
}
