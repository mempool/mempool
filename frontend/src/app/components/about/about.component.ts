import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { IBackendInfo } from 'src/app/interfaces/websocket.interface';
import { Router } from '@angular/router';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  backendInfo$: Observable<IBackendInfo>;
  sponsors$: Observable<any>;
  contributors$: Observable<any>;
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  showNavigateToSponsor = false;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private stateService: StateService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
    this.backendInfo$ = this.stateService.backendInfo$;
    this.seoService.setTitle($localize`:@@004b222ff9ef9dd4771b777950ca1d0e4cd4348a:About`);
    this.websocketService.want(['blocks']);

    this.sponsors$ = this.apiService.getDonation$();
    this.contributors$ = this.apiService.getContributor$();
  }

  sponsor() {
    if (this.officialMempoolSpace) {
      this.router.navigateByUrl('/sponsor');
    } else {
      this.showNavigateToSponsor = true;
    }
  }
}
