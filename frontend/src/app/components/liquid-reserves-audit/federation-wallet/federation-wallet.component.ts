import { Component, OnInit } from '@angular/core';
import { SeoService } from '@app/services/seo.service';

@Component({
  selector: 'app-federation-wallet',
  templateUrl: './federation-wallet.component.html',
  styleUrls: ['./federation-wallet.component.scss']
})
export class FederationWalletComponent implements OnInit {

  constructor(
    private seoService: SeoService
  ) {
    this.seoService.setTitle($localize`:@@993e5bc509c26db81d93018e24a6afe6e50cae52:Liquid Federation Wallet`);
  }

  ngOnInit(): void {
  }

  isExpiredFragment(): boolean {
    return location.hash === '#expired';
  }

}
