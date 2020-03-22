import { Component, OnInit, OnDestroy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, map, tap } from 'rxjs/operators';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-mempool-block',
  templateUrl: './mempool-block.component.html',
  styleUrls: ['./mempool-block.component.scss']
})
export class MempoolBlockComponent implements OnInit, OnDestroy {
  mempoolBlockIndex: number;
  mempoolBlock$: Observable<MempoolBlock>;

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.mempoolBlock$ = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.mempoolBlockIndex = parseInt(params.get('id'), 10) || 0;
          return this.stateService.mempoolBlocks$
            .pipe(
              map((mempoolBlocks) => {
                while (!mempoolBlocks[this.mempoolBlockIndex]) {
                  this.mempoolBlockIndex--;
                }
                return mempoolBlocks[this.mempoolBlockIndex];
              })
            );
        }),
        tap(() => {
          this.stateService.markBlock$.next({ mempoolBlockIndex: this.mempoolBlockIndex });
        })
      );
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
  }

}
