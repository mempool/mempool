import { Component, OnInit, OnDestroy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, map } from 'rxjs/operators';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-mempool-block',
  templateUrl: './mempool-block.component.html',
  styleUrls: ['./mempool-block.component.scss']
})
export class MempoolBlockComponent implements OnInit, OnDestroy {
  mempoolBlockIndex: number;
  mempoolBlock: MempoolBlock;

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);

    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.mempoolBlockIndex = parseInt(params.get('id'), 10) || 0;
        this.stateService.markBlock$.next({ mempoolBlockIndex: this.mempoolBlockIndex });
        return this.stateService.mempoolBlocks$
          .pipe(
            map((mempoolBlocks) => mempoolBlocks[this.mempoolBlockIndex])
          );
      })
    )
    .subscribe((mempoolBlock) => {
      this.mempoolBlock = mempoolBlock;
    });
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
  }

}
