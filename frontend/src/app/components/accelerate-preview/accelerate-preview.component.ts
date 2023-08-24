import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-accelerator-preview',
  templateUrl: 'accelerate-preview.component.html',
  styleUrls: ['accelerate-preview.component.scss']
})

export class AcceleratePreviewComponent implements OnInit {
  constructor(
    private apiService: ApiService
  ) { }

  ngOnInit() {
    this.apiService.estimate$(this.txId).subscribe((estimate) => {
      console.log(estimate.body);
      document.getElementById('acceleratePreviewAnchor').scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'center',
      });
    })
  }
}