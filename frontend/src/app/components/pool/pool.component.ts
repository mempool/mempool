import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap, tap } from 'rxjs/operators';
import { BlockExtended, PoolStat } from 'src/app/interfaces/node-api.interface';
import { ApiService } from 'src/app/services/api.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-pool',
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoolComponent implements OnInit {
  poolStats$: Observable<PoolStat>;
  blocks$: Observable<BlockExtended[]>;

  fromHeight: number = -1;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromHeight);

  blocks: BlockExtended[] = [];
  poolId: number = undefined;
  radioGroupForm: FormGroup;

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    public stateService: StateService,
    private formBuilder: FormBuilder,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1w' });
    this.radioGroupForm.controls.dateSpan.setValue('1w');
  }

  ngOnInit(): void {
    this.poolStats$ = combineLatest([
      this.route.params.pipe(map((params) => params.poolId)),
      this.radioGroupForm.get('dateSpan').valueChanges.pipe(startWith('1w')),
    ])
      .pipe(
        switchMap((params: any) => {
          this.poolId = params[0];
          if (this.blocks.length === 0) {
            this.fromHeightSubject.next(undefined);
          }
          return this.apiService.getPoolStats$(this.poolId, params[1] ?? '1w');
        }),
        map((poolStats) => {
          let regexes = '"';
          for (const regex of poolStats.pool.regexes) {
            regexes += regex + '", "';
          }
          poolStats.pool.regexes = regexes.slice(0, -3);
          poolStats.pool.addresses = poolStats.pool.addresses;

          return Object.assign({
            logo: `./resources/mining-pools/` + poolStats.pool.name.toLowerCase().replace(' ', '').replace('.', '') + '.svg'
          }, poolStats);
        })
      );

    this.blocks$ = this.fromHeightSubject
      .pipe(
        distinctUntilChanged(),
        switchMap((fromHeight) => {
          return this.apiService.getPoolBlocks$(this.poolId, fromHeight);
        }),
        tap((newBlocks) => {
          this.blocks = this.blocks.concat(newBlocks);
        }),
        map(() => this.blocks)
      )
  }

  loadMore() {
    this.fromHeightSubject.next(this.blocks[this.blocks.length - 1]?.height);
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}
