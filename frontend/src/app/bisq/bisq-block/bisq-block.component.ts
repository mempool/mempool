import { Component, OnInit, OnDestroy } from '@angular/core';
import { BisqBlock } from 'src/app/bisq/bisq.interfaces';
import { Location } from '@angular/common';
import { BisqApiService } from '../bisq-api.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { ElectrsApiService } from 'src/app/services/electrs-api.service';

@Component({
  selector: 'app-bisq-block',
  templateUrl: './bisq-block.component.html',
  styleUrls: ['./bisq-block.component.scss']
})
export class BisqBlockComponent implements OnInit, OnDestroy {
  block: BisqBlock;
  subscription: Subscription;
  blockHash = '';
  blockHeight = 0;
  isLoading = true;
  error: any;

  constructor(
    private bisqApiService: BisqApiService,
    private route: ActivatedRoute,
    private seoService: SeoService,
    private electrsApiService: ElectrsApiService,
    private router: Router,
    private location: Location,
  ) { }

  ngOnInit(): void {
    this.subscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          const blockHash = params.get('id') || '';
          document.body.scrollTo(0, 0);
          this.isLoading = true;
          if (history.state.data && history.state.data.blockHeight) {
            this.blockHeight = history.state.data.blockHeight;
          }
          if (history.state.data && history.state.data.block) {
            this.blockHeight = history.state.data.block.height;
            return of(history.state.data.block);
          }

          let isBlockHeight = false;
          if (/^[0-9]+$/.test(blockHash)) {
            isBlockHeight = true;
          } else {
            this.blockHash = blockHash;
          }

          if (isBlockHeight) {
            return this.electrsApiService.getBlockHashFromHeight$(parseInt(blockHash, 10))
              .pipe(
                switchMap((hash) => {
                  this.blockHash = hash;
                  this.location.replaceState(
                    this.router.createUrlTree(['/bisq/block/', hash]).toString()
                  );
                  return this.bisqApiService.getBlock$(this.blockHash);
                })
              );
          }

          return this.bisqApiService.getBlock$(this.blockHash);
        })
      )
      .subscribe((block: BisqBlock) => {
        this.isLoading = false;
        this.blockHeight = block.height;
        this.seoService.setTitle('Block: #' + block.height + ': ' + block.hash, true);
        this.block = block;
      });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
