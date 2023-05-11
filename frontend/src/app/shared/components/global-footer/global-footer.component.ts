import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, merge, of, Subject } from 'rxjs';
import { tap, takeUntil } from 'rxjs/operators';
import { Env, StateService } from '../../../services/state.service';
import { IBackendInfo } from '../../../interfaces/websocket.interface';

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
  network$: Observable<string>;
  currentNetwork = "";

  constructor(
    public stateService: StateService,
  ) {}

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.backendInfo$ = this.stateService.backendInfo$;
    this.network$ = merge(of(''), this.stateService.networkChanged$).pipe(
      tap((network: string) => {
        return network;
      })
    );
    this.network$.pipe(takeUntil(this.destroy$)).subscribe((network) => {
      this.currentNetwork = network;
    });
  }

}
