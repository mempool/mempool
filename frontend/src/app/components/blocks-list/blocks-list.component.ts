import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { map, repeat, tap } from 'rxjs/operators';
import { BlockExtended } from 'src/app/interfaces/node-api.interface';
import { ApiService } from 'src/app/services/api.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-blocks-list',
  templateUrl: './blocks-list.component.html',
  styleUrls: ['./blocks-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocksList implements OnInit {
  blocks$: Observable<BlockExtended[]> = undefined
  isLoading = true;
  oldestBlockHeight = undefined;

  constructor(
    private apiService: ApiService,
    public stateService: StateService
  ) {

  }

  ngOnInit(): void {
    this.blocks$ = this.apiService.getBlocks$(this.oldestBlockHeight)
      .pipe(
        tap(blocks => {
          this.isLoading = false;
        }),
        map(blocks => {
          for (const block of blocks) {
            // @ts-ignore
            block.extras.pool.logo = `./resources/mining-pools/` +
              block.extras.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg';
            this.oldestBlockHeight = block.height;
          }
          return blocks;
        }),
        repeat(2),
      );
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}