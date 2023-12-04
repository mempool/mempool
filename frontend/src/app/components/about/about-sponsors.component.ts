import { Component } from '@angular/core';
import { EnterpriseService } from '../../services/enterprise.service';

@Component({
  selector: 'app-about-sponsors',
  templateUrl: './about-sponsors.component.html',
  styleUrls: ['./about-sponsors.component.scss'],
})
export class AboutSponsorsComponent {
  constructor(private enterpriseService: EnterpriseService) {
  }

  onSponsorClick(e): boolean {
    this.enterpriseService.goal(5);
    return true;
  }

  onEnterpriseClick(e): boolean {
    this.enterpriseService.goal(6);
    return true;
  }
}
