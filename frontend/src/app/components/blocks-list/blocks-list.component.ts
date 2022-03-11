import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { delayWhen, map, retryWhen, switchMap, tap } from 'rxjs/operators';
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
  @Input() widget: boolean = false;

  blocks$: Observable<BlockExtended[]> = undefined

  isLoading = true;
  fromBlockHeight = undefined;
  paginationMaxSize: number;
  page = 1;
  blocksCount: number;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromBlockHeight);
  skeletonLines: number[] = [];

  constructor(
    private apiService: ApiService,
    public stateService: StateService,
  ) {
  }

  ngOnInit(): void {
    this.skeletonLines = this.widget === true ? [...Array(5).keys()] : [...Array(15).keys()]; 
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;
    
    this.blocks$ = this.fromHeightSubject.pipe(
      switchMap(() => {
        this.isLoading = true;
        return this.apiService.getBlocks$(this.fromBlockHeight)
          .pipe(
            tap(blocks => {
              if (this.blocksCount === undefined) {
                this.blocksCount = blocks[0].height;
              }
              this.isLoading = false;
            }),
            map(blocks => {
              for (const block of blocks) {
                // @ts-ignore: Need to add an extra field for the template
                block.extras.pool.logo = `./resources/mining-pools/` +
                  block.extras.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg';
              }
              if (this.widget) {
                return blocks.slice(0, 5);
              }
              return blocks;
            }),
            retryWhen(errors => errors.pipe(delayWhen(() => timer(1000))))
          )
      })
    );
  }

  pageChange(page: number) {
    this.fromBlockHeight = this.blocksCount - (page - 1) * 15;
    this.fromHeightSubject.next(this.fromBlockHeight);
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}