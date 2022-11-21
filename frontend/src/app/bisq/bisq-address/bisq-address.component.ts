import { Component, OnInit, OnDestroy } from '@angular/core';
import { SeoService } from '../../services/seo.service';
import { switchMap, filter, catchError } from 'rxjs/operators';
import { ParamMap, ActivatedRoute } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { BisqTransaction } from '../bisq.interfaces';
import { BisqApiService } from '../bisq-api.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-bisq-address',
  templateUrl: './bisq-address.component.html',
  styleUrls: ['./bisq-address.component.scss']
})
export class BisqAddressComponent implements OnInit, OnDestroy {
  transactions: BisqTransaction[];
  addressString: string;
  isLoadingAddress = true;
  error: any;
  mainSubscription: Subscription;

  totalReceived = 0;
  totalSent = 0;

  constructor(
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private seoService: SeoService,
    private bisqApiService: BisqApiService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks']);

    this.mainSubscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.error = undefined;
          this.isLoadingAddress = true;
          this.transactions = null;
          document.body.scrollTo(0, 0);
          this.addressString = params.get('id') || '';
          this.seoService.setTitle($localize`:@@bisq-address.component.browser-title:Address: ${this.addressString}:INTERPOLATION:`);

          return this.bisqApiService.getAddress$(this.addressString)
            .pipe(
              catchError((err) => {
                this.isLoadingAddress = false;
                this.error = err;
                console.log(err);
                return of(null);
              })
            );
          }),
        filter((transactions) => transactions !== null)
      )
      .subscribe((transactions: BisqTransaction[]) => {
        this.transactions = transactions;
        this.updateChainStats();
        this.isLoadingAddress = false;
      },
      (error) => {
        console.log(error);
        this.error = error;
        this.isLoadingAddress = false;
      });
  }

  updateChainStats() {
    const shortenedAddress = this.addressString.substr(1);

    this.totalSent = this.transactions.reduce((acc, tx) =>
      acc + tx.inputs
        .filter((input) => input.address === shortenedAddress)
        .reduce((a, input) => a + input.bsqAmount, 0), 0);

    this.totalReceived = this.transactions.reduce((acc, tx) =>
      acc + tx.outputs
        .filter((output) => output.address === shortenedAddress)
        .reduce((a, output) => a + output.bsqAmount, 0), 0);
  }

  ngOnDestroy() {
    this.mainSubscription.unsubscribe();
  }
}
