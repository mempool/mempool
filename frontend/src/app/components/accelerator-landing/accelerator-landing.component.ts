import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from '../../services/seo.service';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { IBackendInfo } from '../../interfaces/websocket.interface';
import { Router, ActivatedRoute } from '@angular/router';
import { map, tap } from 'rxjs/operators';
import { ITranslators } from '../../interfaces/node-api.interface';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-accelerator-landing',
  templateUrl: './accelerator-landing.component.html',
  styleUrls: ['./accelerator-landing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceleratorLandingComponent implements OnInit {

  constructor(
    public stateService: StateService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {

  }
  
    anchorLinkClick( event: any ) {
      let targetId = "";
      if( event.target.nodeName === "A" ) {
        targetId = event.target.hash.substring(1);
      } else {
        let element = event.target;
        while( element.nodeName !== "A" ) {
          element = element.parentElement;
        }
        targetId = element.hash.substring(1);
      }
      if( this.route.snapshot.fragment === targetId && document.getElementById( targetId )) {
        document.getElementById( targetId ).scrollIntoView();
      }
      this.openEndpointContainer( targetId );
    }

    openEndpointContainer( targetId ) {
      let tabHeaderHeight = 0;
      if (document.getElementById( targetId + "-tab-header" )) {
        tabHeaderHeight = document.getElementById( targetId + "-tab-header" ).scrollHeight;
      }
      if( targetId ) {
        const endpointContainerEl = document.querySelector<HTMLElement>( "#" + targetId );
        const endpointContentEl = document.querySelector<HTMLElement>( "#" + targetId + " .endpoint-content" );
        const endPointContentElHeight = endpointContentEl.clientHeight;

        if( endpointContentEl.classList.contains( "open" ) ) {
          endpointContainerEl.style.height = "auto";
          endpointContentEl.style.top = "-10000px";
          endpointContentEl.style.opacity = "0";
          endpointContentEl.classList.remove( "open" );
        } else {
          endpointContainerEl.style.height = endPointContentElHeight + tabHeaderHeight + 28 + "px";
          endpointContentEl.style.top = tabHeaderHeight + 28 + "px";
          endpointContentEl.style.opacity = "1";
          endpointContentEl.classList.add( "open" );
        }
      }
    }

}
