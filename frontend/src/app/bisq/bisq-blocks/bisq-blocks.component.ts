import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { BisqApiService } from '../bisq-api.service';
import { switchMap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { BisqBlock, BisqOutput, BisqTransaction } from '../bisq.interfaces';
import { SeoService } from 'src/app/services/seo.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-bisq-blocks',
  templateUrl: './bisq-blocks.component.html',
  styleUrls: ['./bisq-blocks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BisqBlocksComponent implements OnInit {
  blocks$: Observable<[BisqBlock[], number]>;
  page = 1;
  itemsPerPage: number;
  contentSpace = window.innerHeight - (165 + 75);
  fiveItemsPxSize = 250;
  loadingItems: number[];
  isLoading = true;
  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 10;

  constructor(
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Blocks', true);
    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);
    this.loadingItems = Array(this.itemsPerPage);
    if (document.body.clientWidth < 768) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }

    this.blocks$ = this.route.queryParams
      .pipe(
        map((queryParams) => {
          if (queryParams.page) {
            const newPage = parseInt(queryParams.page, 10);
            this.page = newPage;
            this.cd.markForCheck();
            return newPage;
          }
          return 1;
        }),
        switchMap((page) => this.bisqApiService.listBlocks$((page - 1) * this.itemsPerPage, this.itemsPerPage)),
        map((response) => [response.body, parseInt(response.headers.get('x-total-count'), 10)]),
      );
  }

  calculateTotalOutput(block: BisqBlock): number {
    return block.txs.reduce((a: number, tx: BisqTransaction) =>
      a + tx.outputs.reduce((acc: number, output: BisqOutput) => acc + output.bsqAmount, 0), 0
    );
  }

  trackByFn(index: number) {
    return index;
  }

  pageChange(page: number) {
    this.router.navigate([], {
      queryParams: { page: page },
      queryParamsHandling: 'merge',
    });
  }
}
