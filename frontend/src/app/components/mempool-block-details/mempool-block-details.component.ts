import { Component, Input } from "@angular/core";
import { Observable } from "rxjs";
import { StateService } from "src/app/services/state.service";
@Component({
  selector: "app-mempool-block-details",
  templateUrl: "./mempool-block-details.component.html",
  styleUrls: ["./mempool-block-details.component.scss"],
})
export class MempoolBlockDetailsComponent {
  network$: Observable<string>;
  constructor(public stateService: StateService) {}
  @Input() mempoolBlock: any;
}
