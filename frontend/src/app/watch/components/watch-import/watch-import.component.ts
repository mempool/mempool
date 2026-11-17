import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DEFAULT_GAP_LIMIT, ScriptTypeCheck, WalletPageState, WalletSessionService } from '@app/watch/services/wallet-session.service';
import { countListedAddresses, looksLikeAddressList } from '@app/watch/address-list';
import { BARE_KEY_SCRIPT_OPTIONS, scriptTypeName } from '@app/watch/script-type-name';
import { isBareExtendedKey, looksLikeDescriptor } from '@app/watch/watch-key.utils';
import { ScriptType } from '@app/watch/watch.types';

@Component({
  selector: 'app-watch-import',
  templateUrl: './watch-import.component.html',
  styleUrls: ['./watch-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchImportComponent {
  @Input({ required: true }) state!: WalletPageState;

  readonly scriptTypes = BARE_KEY_SCRIPT_OPTIONS;

  keyInput = '';
  label = '';
  scriptTypeHint: ScriptType = 'wpkh';
  // Until set, a single type found with history is preselected. Reset when the key changes.
  scriptTypeChosen = false;

  constructor(public session: WalletSessionService) {}

  // The name is optional; an empty one is saved as "My Wallet".
  get canLoad(): boolean {
    return !!this.keyInput.trim();
  }

  get needsScriptTypeHint(): boolean {
    const input = this.keyInput.trim();
    return input.startsWith('xpub') || input.startsWith('tpub');
  }

  get scriptTypeCheck(): ScriptTypeCheck | null {
    const check = this.state.scriptTypeCheck;
    return check && check.input === this.keyInput.trim() ? check : null;
  }

  get checkingScriptType(): boolean {
    return this.scriptTypeCheck?.status === 'checking';
  }

  /** The types with history, once the check is done. */
  get withHistory(): ScriptType[] | null {
    const check = this.scriptTypeCheck;
    return check?.status === 'done' ? check.withHistory : null;
  }

  get selectedScriptType(): ScriptType {
    const withHistory = this.withHistory;
    return !this.scriptTypeChosen && withHistory?.length === 1 ? withHistory[0] : this.scriptTypeHint;
  }

  /** Several types have history and the user hasn't picked one for this key yet. */
  get needsScriptTypeChoice(): boolean {
    return !this.scriptTypeChosen && (this.withHistory?.length ?? 0) > 1;
  }

  get selectedOption(): (typeof BARE_KEY_SCRIPT_OPTIONS)[number] {
    return this.scriptTypes.find((t) => t.value === this.selectedScriptType) ?? this.scriptTypes[0];
  }

  hasHistory(type: ScriptType): boolean {
    return !!this.withHistory?.includes(type);
  }

  /** The check finished and found no history on any address type. */
  get noneWithHistory(): boolean {
    return this.withHistory?.length === 0;
  }

  onKeyInput(value: string): void {
    if (value.trim() !== this.keyInput.trim()) {
      this.scriptTypeHint = 'wpkh';
      this.scriptTypeChosen = false;
    }
    this.keyInput = value;
    this.session.clearError();
    this.session.checkScriptType(value);
  }

  chooseScriptType(type: ScriptType): void {
    this.scriptTypeHint = type;
    this.scriptTypeChosen = true;
  }

  // A hint from the input's shape only; import validates it.
  get detectedInput(): string {
    const input = this.keyInput.trim();
    if (!input) {
      return '';
    }
    if (looksLikeDescriptor(input)) {
      return $localize`:@@watch.detected-descriptor:Output descriptor`;
    }
    if (looksLikeAddressList(input)) {
      const count = countListedAddresses(input);
      return count === 1
        ? $localize`:@@watch.detected-address-list-one:Address list (1 address)`
        : $localize`:@@watch.detected-address-list:Address list (${count}:count: addresses)`;
    }
    if (this.needsScriptTypeHint) {
      return $localize`:@@watch.detected-xpub:Extended public key`;
    }
    if (/^[YZUV]pub/.test(input)) {
      return $localize`:@@watch.detected-multisig-key:Multisig cosigner key (import the wallet's descriptor)`;
    }
    if (/^[zv]pub/.test(input)) {
      return scriptTypeName('wpkh');
    }
    if (/^[yu]pub/.test(input)) {
      return scriptTypeName('sh_wpkh');
    }
    return '';
  }

  async import(): Promise<void> {
    // Enter in the name field submits the form even while the Load button is hidden.
    if (!this.canLoad || this.needsScriptTypeChoice) {
      return;
    }
    const bareKey = this.needsScriptTypeHint;
    const done = await this.session.importWallet({
      input: this.keyInput,
      label: this.label,
      gapLimit: DEFAULT_GAP_LIMIT,
      scriptTypeHint: bareKey ? this.selectedScriptType : undefined,
      detectScriptType: bareKey && !this.scriptTypeChosen && isBareExtendedKey(this.keyInput),
    });
    if (done) {
      this.clearForm();
    }
  }

  /** Unlike onKeyInput(''), leaves the session error alone: showing an already-saved wallet can fail. */
  private clearForm(): void {
    this.keyInput = '';
    this.scriptTypeHint = 'wpkh';
    this.scriptTypeChosen = false;
    this.session.checkScriptType('');
  }
}
