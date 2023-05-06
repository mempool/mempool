import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { NavigationService } from '../../../services/navigation.service';
import { Env, StateService } from '../../../services/state.service';
import { IBackendInfo } from '../../../interfaces/websocket.interface';

@Component({
  selector: 'app-global-footer',
  templateUrl: './global-footer.component.html',
  styleUrls: ['./global-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalFooterComponent implements OnInit {
  env: Env;
  networkPaths: { [network: string]: string };
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  networkPaths$: Observable<Record<string, string>>;
  backendInfo$: Observable<IBackendInfo>;
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;

  constructor(
    public stateService: StateService,
    private navigationService: NavigationService,
  ) {}

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.networkPaths$ = this.navigationService.subnetPaths;
    this.backendInfo$ = this.stateService.backendInfo$;
  }

}
