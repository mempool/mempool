import { Component, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';
import { env } from '../../app.constants';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  gitCommit$: Observable<string>;
  donationForm: FormGroup;
  paymentForm: FormGroup;
  donationStatus = 1;
  sponsors$: Observable<any>;
  donationObj: any;
  sponsorsEnabled = env.SPONSORS_ENABLED;
  sponsors = null;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private stateService: StateService,
    private formBuilder: FormBuilder,
    private apiService: ApiService,
    private sanitizer: DomSanitizer,
  ) { }

  ngOnInit() {
    this.gitCommit$ = this.stateService.gitCommit$.pipe(map((str) => str.substr(0, 8)));
    this.seoService.setTitle('About');
    this.websocketService.want(['blocks']);

    this.donationForm = this.formBuilder.group({
      amount: [0.01, [Validators.min(0.001), Validators.required]],
      handle: [''],
    });

    this.paymentForm = this.formBuilder.group({
      'method': 'chain'
    });

    this.apiService.getDonation$()
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
      this.donationStatus = 3;
    });
  }

  bypassSecurityTrustUrl(text: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(text);
  }
}
