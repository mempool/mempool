import { Component, OnInit } from "@angular/core";
import { StateService } from "src/app/services/state.service";

@Component({
  selector: 'app-graphs',
  templateUrl: './graphs.component.html',
  styleUrls: ['./graphs.component.scss'],
})
export class GraphsComponent implements OnInit {
  constructor(public stateService: StateService) { }

  ngOnInit(): void {

  }
}
