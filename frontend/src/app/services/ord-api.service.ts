import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { Inscription } from '../components/ord-data/ord-data.component';
import { Transaction } from '../interfaces/electrs.interface';
import { getNextInscriptionMark, hexToBytes, extractInscriptionData } from '../shared/ord/inscription.utils';
import { Runestone } from '../shared/ord/rune/runestone';
import { Etching } from '../shared/ord/rune/etching';
import { ElectrsApiService } from './electrs-api.service';
import { UNCOMMON_GOODS } from '../shared/ord/rune/runestone';

@Injectable({
  providedIn: 'root'
})
export class OrdApiService {

  constructor(
    private electrsApiService: ElectrsApiService,
  ) { }

  decodeRunestone$(tx: Transaction): Observable<{ runestone: Runestone, runeInfo: { [id: string]: { etching: Etching; txid: string; } } }> {
    const runestoneTx = { vout: tx.vout.map(vout => ({ scriptpubkey: vout.scriptpubkey })) };
    const decipher = Runestone.decipher(runestoneTx);

    // For now, ignore cenotaphs
    let message = decipher.isSome() ? decipher.unwrap() : null;
    if (message?.type === 'cenotaph') {
      return of({ runestone: null, runeInfo: {} });
    }

    const runestone = message as Runestone;
    const runeInfo: { [id: string]: { etching: Etching; txid: string; } } = {};
    const runesToFetch: Set<string> = new Set();

    if (runestone) {
      if (runestone.mint.isSome()) {
        const mint = runestone.mint.unwrap().toString();

        if (mint === '1:0') {
          runeInfo[mint] = { etching: UNCOMMON_GOODS, txid: '0000000000000000000000000000000000000000000000000000000000000000' };
        } else {
          runesToFetch.add(mint);
        }
      }

      if (runestone.edicts.length) {
        runestone.edicts.forEach(edict => {
          runesToFetch.add(edict.id.toString());
        });
      }

      if (runesToFetch.size) {
        const runeEtchingObservables = Array.from(runesToFetch).map(runeId => {
          return this.getEtchingFromRuneId$(runeId).pipe(
            tap(etching => {
              if (etching) {
                runeInfo[runeId] = etching;
              }
            })
          );
        });

        return forkJoin(runeEtchingObservables).pipe(
          map(() => {
            return { runestone: runestone, runeInfo };
          })
        );
      }
    }

    return of({ runestone: runestone, runeInfo });
  }

  // Get etching from runeId by looking up the transaction that etched the rune
  getEtchingFromRuneId$(runeId: string): Observable<{ etching: Etching; txid: string; }> {
    const [blockNumber, txIndex] = runeId.split(':');

    return this.electrsApiService.getBlockHashFromHeight$(parseInt(blockNumber)).pipe(
      switchMap(blockHash => this.electrsApiService.getBlockTxId$(blockHash, parseInt(txIndex))),
      switchMap(txId => this.electrsApiService.getTransaction$(txId)),
      switchMap(tx => {
        const decipheredMessage = Runestone.decipher(tx);
        if (decipheredMessage.isSome()) {
          const message = decipheredMessage.unwrap();
          if (message?.type === 'runestone' && message.etching.isSome()) {
            return of({ etching: message.etching.unwrap(), txid: tx.txid });
          }
        }
        return of(null);
      }),
      catchError(() => of(null))
    );
  }

  decodeInscriptions(witness: string): Inscription[] | null {

    const inscriptions: Inscription[] = [];
    const raw = hexToBytes(witness);
    let startPosition = 0;

    while (true) {
      const pointer = getNextInscriptionMark(raw, startPosition);
      if (pointer === -1) break;

      const inscription = extractInscriptionData(raw, pointer);
      if (inscription) {
        inscriptions.push(inscription);
      }

      startPosition = pointer;
    }

    return inscriptions;
  }
}
