import { Component, OnInit, OnDestroy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, map, tap } from 'rxjs/operators';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { Observable } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-mempool-block',
  templateUrl: './mempool-block.component.html',
  styleUrls: ['./mempool-block.component.scss']
})
export class MempoolBlockComponent implements OnInit, OnDestroy {
  network = environment.network;
  mempoolBlockIndex: number;
  mempoolBlock$: Observable<MempoolBlock>;

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private seoService: SeoService,
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
              this.seoService.setTitle(this.getGetOrdinal());
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

  getGetOrdinal() {
    if (this.mempoolBlockIndex === 0) {
      return 'Next block';
    }

    const s = ['th', 'st', 'nd', 'rd'];
    const v = this.mempoolBlockIndex + 1 % 100;
    return this.mempoolBlockIndex + 1 + (s[(v - 20) % 10] || s[v] || s[0]) + ' next block';
 }

}
