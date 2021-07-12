import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { delay, retryWhen, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-sponsor',
  templateUrl: './sponsor.component.html',
  styleUrls: ['./sponsor.component.scss'],
})
export class SponsorComponent implements OnInit, OnDestroy {
  sponsorsEnabled = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  donationForm: FormGroup;
  paymentForm: FormGroup;
  requestSubscription: Subscription | undefined;
  donationObj: any;
  donationStatus = 1;

  constructor(
    private formBuilder: FormBuilder,
    private apiService: ApiService,
    private sanitizer: DomSanitizer,
    private stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@dfd99c62b5b308fc5b1ad7adbbf9d526d2b31516:Sponsor`);
    this.websocketService.want(['blocks']);

    this.paymentForm = this.formBuilder.group({
      method: 'chain',
    });

    this.donationForm = this.formBuilder.group({
      selection: [0.01],
      handle: [''],
    });
  }

  submitDonation() {
    if (this.donationForm.invalid) {
      return;
    }
    this.requestSubscription = this.apiService
      .requestDonation$(this.donationForm.get('selection').value, this.donationForm.get('handle').value)
      .pipe(
        tap(response => {
          this.donationObj = response;
          this.donationStatus = 2;
        }),
        switchMap(() =>
          this.apiService.checkDonation$(this.donationObj.id).pipe(retryWhen(errors => errors.pipe(delay(2000))))
        )
      )
      .subscribe(() => {
        this.donationStatus = 3;
        /*
      if (this.donationForm.get('handle').value) {
        this.sponsors.unshift({ handle: this.donationForm.get('handle').value });
      }
      */
      });
  }

  setSelection(amount: number): void {
    this.donationForm.get('selection').setValue(amount);
  }

  bypassSecurityTrustUrl(text: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(text);
  }

  ngOnDestroy() {
    if (this.requestSubscription) {
      this.requestSubscription.unsubscribe();
    }
  }
}
