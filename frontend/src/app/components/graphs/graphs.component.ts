import { Component, OnInit } from "@angular/core";
import { StateService } from "src/app/services/state.service";
import { WebsocketService } from "src/app/services/websocket.service";

@Component({
  selector: 'app-graphs',
  templateUrl: './graphs.component.html',
  styleUrls: ['./graphs.component.scss'],
})
export class GraphsComponent implements OnInit {
  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);
  }
}
