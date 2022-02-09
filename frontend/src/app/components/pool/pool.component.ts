import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { BlockExtended, PoolStat } from 'src/app/interfaces/node-api.interface';
import { ApiService } from 'src/app/services/api.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-pool',
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.scss']
})
export class PoolComponent implements OnInit {
  poolStats$: Observable<PoolStat>;
  isLoading = false;

  poolId: number;
  interval: string;

  blocks: any[] = [];

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    public stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.poolStats$ = this.route.params
      .pipe(
        switchMap((params) => {
          this.poolId = params.poolId;
          this.interval = params.interval;
          this.loadMore(2);
          return this.apiService.getPoolStats$(params.poolId, params.interval ?? 'all');
        }),
      );
  }

  loadMore(chunks = 0) {
    let fromHeight: number | undefined;
    if (this.blocks.length > 0) {
      fromHeight = this.blocks[this.blocks.length - 1].height - 1;
    }

    this.apiService.getPoolBlocks$(this.poolId, fromHeight)
      .subscribe((blocks) => {
        this.blocks = this.blocks.concat(blocks);

        const chunksLeft = chunks - 1;
        if (chunksLeft > 0) {
          this.loadMore(chunksLeft);
        }
        // this.cd.markForCheck();
      },
      (error) => {
        console.log(error);
        // this.cd.markForCheck();
      });
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}
