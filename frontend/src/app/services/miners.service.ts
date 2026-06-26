import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { BlockExtended, StaleTip } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';

interface Miner {
  name: string;
  slug: string;
  tags: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MinersService {
  private apiBaseUrl = '';
  private miners$: Observable<Miner[]>;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    if (!stateService.isBrowser) {
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.miners$ = this.httpClient.get<Miner[]>(this.apiBaseUrl + '/resources/miners.json').pipe(
      catchError(() => of([])),
      shareReplay(1)
    );
  }

  public applyBlockMinerDetails$(block: BlockExtended): Observable<BlockExtended> {
    if (!block?.extras?.pool?.minerNames?.length) {
      return of(block);
    }
    return this.miners$.pipe(map((miners) => this.applyBlockMinerDetails(block, miners)));
  }

  public applyBlocksMinerDetails$(blocks: BlockExtended[]): Observable<BlockExtended[]> {
    if (!blocks?.some((block) => block?.extras?.pool?.minerNames?.length)) {
      return of(blocks);
    }
    return this.miners$.pipe(map((miners) => blocks.map((block) => this.applyBlockMinerDetails(block, miners))));
  }

  public applyStaleTipsMinerDetails$(staleTips: StaleTip[]): Observable<StaleTip[]> {
    if (!staleTips?.some((staleTip) => staleTip.stale?.extras?.pool?.minerNames?.length || staleTip.canonical?.extras?.pool?.minerNames?.length)) {
      return of(staleTips);
    }
    return this.miners$.pipe(
      map((miners) => staleTips.map((staleTip) => {
        this.applyBlockMinerDetails(staleTip.stale, miners);
        this.applyBlockMinerDetails(staleTip.canonical, miners);
        return staleTip;
      }))
    );
  }

  private applyBlockMinerDetails(block: BlockExtended, miners: Miner[]): BlockExtended {
    const minerNames = block?.extras?.pool?.minerNames;
    if (!minerNames?.length) {
      return block;
    }

    const miner = miners.find((minerEntry) => minerEntry.tags.some((tag) => minerNames.includes(tag)));
    if (miner?.name && miner.slug) {
      block.extras.pool.minerName = miner.name;
      block.extras.pool.minerSlug = miner.slug;
    }
    return block;
  }
}
