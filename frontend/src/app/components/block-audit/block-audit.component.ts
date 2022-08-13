import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, share, switchMap, tap } from 'rxjs/operators';
import { BlockAudit, TransactionStripped } from 'src/app/interfaces/node-api.interface';
import { ApiService } from 'src/app/services/api.service';
import { StateService } from 'src/app/services/state.service';
import { detectWebGL } from 'src/app/shared/graphs.utils';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { BlockOverviewGraphComponent } from '../block-overview-graph/block-overview-graph.component';

@Component({
  selector: 'app-block-audit',
  templateUrl: './block-audit.component.html',
  styleUrls: ['./block-audit.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class BlockAuditComponent implements OnInit, OnDestroy {
  blockAudit: BlockAudit = undefined;
  transactions: string[];
  auditObservable$: Observable<BlockAudit>;

  paginationMaxSize: number;
  page = 1;
  itemsPerPage: number;

  mode: 'missing' | 'added' = 'missing';
  isLoading = true;
  webGlEnabled = true;
  isMobile = window.innerWidth <= 767.98;

  @ViewChild('blockGraphTemplate') blockGraphTemplate: BlockOverviewGraphComponent;
  @ViewChild('blockGraphMined') blockGraphMined: BlockOverviewGraphComponent;

  constructor(
    private route: ActivatedRoute,
    public stateService: StateService,
    private router: Router,
    private apiService: ApiService
  ) {
    this.webGlEnabled = detectWebGL();
  }

  ngOnDestroy(): void {
  }

  ngOnInit(): void {
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;
    this.itemsPerPage = this.stateService.env.ITEMS_PER_PAGE;

    this.auditObservable$ = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const blockHash: string = params.get('id') || '';
        return this.apiService.getBlockAudit$(blockHash)
          .pipe(
            map((response) => {
              const blockAudit = response.body;
              for (let i = 0; i < blockAudit.template.length; ++i) {
                if (blockAudit.missingTxs.includes(blockAudit.template[i].txid)) {
                  blockAudit.template[i].status = 'missing';
                } else if (blockAudit.addedTxs.includes(blockAudit.template[i].txid)) {
                  blockAudit.template[i].status = 'added';
                } else {
                  blockAudit.template[i].status = 'found';
                }
              }
              for (let i = 0; i < blockAudit.transactions.length; ++i) {
                if (blockAudit.missingTxs.includes(blockAudit.transactions[i].txid)) {
                  blockAudit.transactions[i].status = 'missing';
                } else if (blockAudit.addedTxs.includes(blockAudit.transactions[i].txid)) {
                  blockAudit.transactions[i].status = 'added';
                } else {
                  blockAudit.transactions[i].status = 'found';
                }
              }
              return blockAudit;
            }),
            tap((blockAudit) => {
              this.changeMode(this.mode);
              if (this.blockGraphTemplate) {
                this.blockGraphTemplate.destroy();
                this.blockGraphTemplate.setup(blockAudit.template);
              }
              if (this.blockGraphMined) {
                this.blockGraphMined.destroy();
                this.blockGraphMined.setup(blockAudit.transactions);
              }
              this.isLoading = false;
            }),
          );
      }),
      share()
    );
  }

  onResize(event: any) {
    this.isMobile = event.target.innerWidth <= 767.98;
    this.paginationMaxSize = event.target.innerWidth < 670 ? 3 : 5;
  }

  changeMode(mode: 'missing' | 'added') {
    this.router.navigate([], { fragment: mode });
    this.mode = mode;
  }

  onTxClick(event: TransactionStripped): void {
    const url = new RelativeUrlPipe(this.stateService).transform(`/tx/${event.txid}`);
    this.router.navigate([url]);
  }

  pageChange(page: number, target: HTMLElement) {
  }
}
