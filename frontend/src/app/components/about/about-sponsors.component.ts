import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-about-sponsors',
  templateUrl: './about-sponsors.component.html',
  styleUrls: ['./about-sponsors.component.scss'],
  standalone: false,
})
export class AboutSponsorsComponent {
  @Input() host = 'https://mempool.space';
  @Input() context = 'about';
}
