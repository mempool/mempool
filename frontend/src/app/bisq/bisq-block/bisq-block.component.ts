import { Component, OnInit, OnDestroy } from '@angular/core';
import { BisqTransaction, BisqBlock } from 'src/app/bisq/bisq.interfaces';
import { BisqApiService } from '../bisq-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscribable, Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';

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
  ) { }

  ngOnInit(): void {
    this.subscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.blockHash = params.get('id') || '';
          document.body.scrollTo(0, 0);
          this.isLoading = true;
          if (history.state.data && history.state.data.blockHeight) {
            this.blockHeight = history.state.data.blockHeight;
          }
          if (history.state.data && history.state.data.block) {
            this.blockHeight = history.state.data.block.height;
            return of(history.state.data.block);
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
