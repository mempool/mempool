import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DEFAULT_GAP_LIMIT, WalletPageState, WalletSessionService } from '@app/watch/services/wallet-session.service';
import { countListedAddresses, looksLikeAddressList } from '@app/watch/address-list';
import { BARE_KEY_SCRIPT_OPTIONS, scriptTypeName } from '@app/watch/script-type-name';
import { looksLikeDescriptor } from '@app/watch/watch-key.utils';
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

  constructor(public session: WalletSessionService) {}

  get canLoad(): boolean {
    return !!this.label.trim() && !!this.keyInput.trim();
  }

  get needsScriptTypeHint(): boolean {
    const input = this.keyInput.trim();
    return input.startsWith('xpub') || input.startsWith('tpub');
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
    if (!this.canLoad) {
      return;
    }
    await this.session.importWallet({
      input: this.keyInput,
      label: this.label,
      gapLimit: DEFAULT_GAP_LIMIT,
      scriptTypeHint: this.needsScriptTypeHint ? this.scriptTypeHint : undefined,
    });
    if (!this.session.state.error) {
      this.keyInput = '';
    }
  }
}
