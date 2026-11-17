import { BARE_KEY_SCRIPT_TYPES, describeScriptType, scriptKind } from '@app/watch/watch-key.utils';

export function scriptTypeName(scriptType: string): string {
  switch (scriptKind(scriptType)) {
    case 'wpkh':   return $localize`:@@watch.script-type.wpkh:Native SegWit`;
    case 'shwpkh': return $localize`:@@watch.script-type.sh-wpkh:Nested SegWit`;
    case 'pkh':    return $localize`:@@watch.script-type.pkh:Legacy`;
    case 'tr':     return $localize`:@@watch.script-type.tr:Taproot`;
    default:       return scriptType;
  }
}

export function multisigName(threshold: number, keys: number): string {
  return $localize`:@@watch.script-type.multisig:Multisig ${threshold}:threshold:-of-${keys}:keys:`;
}

export const BARE_KEY_SCRIPT_OPTIONS = BARE_KEY_SCRIPT_TYPES.map((value) => ({ value, label: scriptTypeName(value), path: describeScriptType(value).path }));
