import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-slideshow',
  templateUrl: './slideshow.component.html',
  styleUrls: ['./slideshow.component.scss']
})
export class SlideshowComponent implements OnInit {
  currentPage = 0;
  pages = [
    'slideshow',
    'slideshow/tv',
    'slideshow/bisq',
  ];

  constructor(
    private router: Router,
  ) { }

  ngOnInit(): void {
    setInterval(this.slide.bind(this), 30000);
  }

  slide() {
    this.currentPage++;
    if (this.currentPage > 2) {
      this.currentPage = 0;
    }
    this.router.navigateByUrl(this.pages[this.currentPage]);
  }

}
