import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  active = 1;
  hostname = document.location.hostname;
  gitCommit$: Observable<string>;
  donationForm: FormGroup;
  donationStatus = 1;
  sponsors$: Observable<any>;
  donationObj: any;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private stateService: StateService,
    private formBuilder: FormBuilder,
    private apiService: ApiService,
  ) { }

  ngOnInit() {
    this.gitCommit$ = this.stateService.gitCommit$;
    this.seoService.setTitle('About');
    this.websocketService.want(['blocks']);
    if (this.stateService.network === 'bisq') {
      this.active = 2;
    }
    if (document.location.port !== '') {
      this.hostname = this.hostname + ':' + document.location.port;
    }

    this.donationForm = this.formBuilder.group({
      amount: [0.001],
      handle: [''],
    });

    this.sponsors$ = this.apiService.getDonation$();
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

  openTwitterProfile(handle: string) {
    window.open('https://twitter.com/' + handle, '_blank');
  }
}
