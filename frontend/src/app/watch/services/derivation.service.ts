import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { clearDerivers, deriveAddresses, prepareInput, PreparedInput, scriptCandidates, ScriptCandidate, validateAddressList } from '@app/watch/derivation';
import { InputError } from '@app/watch/input-error';
import { RequestCancelledError } from '@app/watch/api-retry';
import { describeInputError } from '@app/watch/input-errors';
import { Chain, DerivedAddress, ScriptType, WatchNetwork } from '@app/watch/watch.types';

function derivationFailed(reason: string | undefined): string {
  return reason
    ? $localize`:@@watch.error.derivation-failed:Address derivation failed: ${reason}:reason:`
    : $localize`:@@watch.error.derivation-failed-unknown:Address derivation failed.`;
}

function userFacingError(e: unknown): Error {
  if (e instanceof RequestCancelledError) {
    return e;
  }
  if (e instanceof InputError) {
    return new Error(describeInputError(e.code, e.params));
  }
  return new Error(derivationFailed(e instanceof Error ? e.message : String(e)));
}

// Runs outside Angular's zone so derivation's yields do not each trigger change
// detection; results settle back inside it. Rejections carry translated messages, or are a
// RequestCancelledError once the caller has cancelled or the service is destroyed.
@Injectable()
export class DerivationService implements OnDestroy {
  private destroyed = false;

  constructor(private zone: NgZone) {}

  prepare(input: string, network: WatchNetwork, scriptTypeHint?: ScriptType): Promise<PreparedInput> {
    return this.run(async () => prepareInput(input, network, scriptTypeHint));
  }

  scriptCandidates(input: string, network: WatchNetwork): Promise<ScriptCandidate[]> {
    return this.run(async () => scriptCandidates(input, network));
  }

  async derive(
    descriptor: string,
    network: WatchNetwork,
    chain: Chain,
    from: number,
    count: number,
    isCancelled: () => boolean = () => false,
  ): Promise<DerivedAddress[]> {
    const cancelled = (): boolean => this.destroyed || isCancelled();
    const addresses = await this.run(() => deriveAddresses(descriptor, network, chain, from, count, cancelled));
    return addresses.map(({ address, scriptPubKey }, i) => ({ address, scriptPubKey, chain, index: from + i }));
  }

  /** Addresses become receive-chain entries numbered in the order pasted. */
  async parseAddressList(input: string, network: WatchNetwork): Promise<DerivedAddress[]> {
    const addresses = await this.run(async () => validateAddressList(input, network));
    return addresses.map(({ address, scriptPubKey }, index) => ({ address, scriptPubKey, chain: 0, index }));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearDerivers();
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.zone.runOutsideAngular(() => {
        task().then(
          (value) => this.zone.run(() => resolve(value)),
          (e) => this.zone.run(() => reject(userFacingError(e))),
        );
      });
    });
  }
}
