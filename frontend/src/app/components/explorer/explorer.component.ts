import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss']
})
export class ExplorerComponent implements OnInit {
  view: 'blocks' | 'transactions' = 'blocks';

  constructor(
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.fragment
      .subscribe((fragment: string) => {
        if (fragment === 'transactions' ) {
          this.view = 'transactions';
        }
    });
  }

}
