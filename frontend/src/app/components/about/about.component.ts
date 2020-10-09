import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';
import { env } from '../../app.constants';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  gitCommit$: Observable<string>;
  donationForm: FormGroup;
  donationStatus = 1;
  sponsors$: Observable<any>;
  donationObj: any;
  sponsorsEnabled = env.SPONSORS_ENABLED;
  sponsors = null;
  bitcoinUrl: SafeUrl;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private stateService: StateService,
    private formBuilder: FormBuilder,
    private apiService: ApiService,
    private sanitizer: DomSanitizer,
  ) { }

  ngOnInit() {
    this.gitCommit$ = this.stateService.gitCommit$;
    this.seoService.setTitle('About');
    this.websocketService.want(['blocks']);

    this.donationForm = this.formBuilder.group({
      amount: [0.01],
      handle: [''],
    });

    (this.sponsorsEnabled ? this.apiService.getDonation$() : this.apiService.getDonationRemote$())
      .subscribe((sponsors) => {
        this.sponsors = sponsors;
      });

    this.apiService.getDonation$()
    this.stateService.donationConfirmed$.subscribe(() => this.donationStatus = 4);
  }

  submitDonation() {
    if (this.donationForm.invalid) {
      return;
    }
    this.apiService.requestDonation$(
      this.donationForm.get('amount').value,
      this.donationForm.get('handle').value
    )
    .subscribe((response) => {
      this.websocketService.trackDonation(response.id);
      this.donationObj = response;
      this.bitcoinUrl = this.sanitizer.bypassSecurityTrustUrl('bitcoin:' + this.donationObj.address + '?amount=' + this.donationObj.amount);
      this.donationStatus = 3;
    });
  }
}
