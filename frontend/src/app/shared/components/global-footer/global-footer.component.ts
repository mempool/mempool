import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, merge, of, Subject } from 'rxjs';
import { tap, takeUntil } from 'rxjs/operators';
import { Env, StateService } from '../../../services/state.service';
import { IBackendInfo } from '../../../interfaces/websocket.interface';
import { LanguageService } from '../../../services/language.service';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-global-footer',
  templateUrl: './global-footer.component.html',
  styleUrls: ['./global-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalFooterComponent implements OnInit {
  private destroy$: Subject<any> = new Subject<any>();
  env: Env;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  backendInfo$: Observable<IBackendInfo>;
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;
  urlLanguage: string;
  network$: Observable<string>;
  networkPaths: { [network: string]: string };
  currentNetwork = "";

  constructor(
    public stateService: StateService,
    private languageService: LanguageService,
    private navigationService: NavigationService,
  ) {}

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.backendInfo$ = this.stateService.backendInfo$;
    this.urlLanguage = this.languageService.getLanguageForUrl();
    this.navigationService.subnetPaths.subscribe((paths) => {
      this.networkPaths = paths;
    });
    this.network$ = merge(of(''), this.stateService.networkChanged$).pipe(
      tap((network: string) => {
        return network;
      })
    );
    this.network$.pipe(takeUntil(this.destroy$)).subscribe((network) => {
      this.currentNetwork = network;
    });
    console.log(this.networkPaths);
  }

  networkLink( network ) {
    let thisNetwork = network || "mainnet";
    if( network === "" || network === "mainnet" || network === "testnet" || network === "signet" ) {
      return ( this.env.BASE_MODULE === 'mempool' ? "" : this.env.MEMPOOL_WEBSITE_URL + this.urlLanguage ) + this.networkPaths[thisNetwork] || '/';
    }
    if( network === "liquid" || network === "liquidtestnet" ) {
      return ( this.env.BASE_MODULE === 'liquid' ? "" : this.env.LIQUID_WEBSITE_URL + this.urlLanguage ) + this.networkPaths[thisNetwork] || '/';
    }
    if( network === "bisq" ) {
      return ( this.env.BASE_MODULE === 'bisq' ? "" : this.env.BISQ_WEBSITE_URL + this.urlLanguage ) + this.networkPaths[thisNetwork] || '/';
    }
  }

}
