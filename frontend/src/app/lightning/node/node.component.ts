import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss']
})
export class NodeComponent implements OnInit {
  node$: Observable<any>;

  constructor(
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.node$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          return this.lightningApiService.getNode$(params.get('id'));
        })
      );
  }

}
