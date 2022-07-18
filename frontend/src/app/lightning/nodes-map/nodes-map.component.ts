import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import am5geodata_worldLow from "@amcharts/amcharts5-geodata/worldLow";
import am5geodata_data_countries2 from "@amcharts/amcharts5-geodata/data/countries2";
import { mempoolFeeColors } from 'src/app/app.constants';
import { SeoService } from 'src/app/services/seo.service';
import { ApiService } from 'src/app/services/api.service';
import { Observable, Subscription, tap } from 'rxjs';

@Component({
  selector: 'app-nodes-map',
  templateUrl: './nodes-map.component.html',
  styleUrls: ['./nodes-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesMap implements OnInit, OnDestroy {
  nodesPerCountryObservable$: Observable<any>;
  subscription: Subscription;

  root = undefined;
  worldSeries = undefined;

  constructor(
    private seoService: SeoService,
    private apiService: ApiService
  ) {
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`Lightning nodes world map`);

    this.nodesPerCountryObservable$ = this.apiService.getNodesPerCountry()
      .pipe(
        tap(response => {
          const nodesPerCountry = {};
          let avg = 0;
          for (const country of response) {
            nodesPerCountry[country.iso] = country.count;
            avg += country.count;
          }
          avg = Math.round(avg / response.length);

          // Set up data for countries
          const data = [];
          for (const id in am5geodata_data_countries2) {
            const country = am5geodata_data_countries2[id];
            if (country.maps.length) {
              const colorIndex = Math.floor((Math.min(avg, nodesPerCountry[id] ?? 0)) / avg * (mempoolFeeColors.length - 1));
              data.push({
                id: id,
                map: country.maps[0],
                polygonSettings: {
                  fill: '#' + mempoolFeeColors[colorIndex],
                  tooltipText: `{name}\n${nodesPerCountry[id] ?? 0} nodes`,
                }
              });
            }
          }
          this.worldSeries.data.setAll(data);
          return response.nodes;
        })
      );

    this.subscription = this.nodesPerCountryObservable$.subscribe();

    this.root = am5.Root.new("chartdiv");
    const chart = this.root.container.children.push(
      am5map.MapChart.new(this.root, {
        projection: am5map.geoNaturalEarth1(),
        panX: "none",
        panY: "none",
        wheelY: "none",
      })
    );
    this.root.container.children.push(chart);

    this.worldSeries = chart.series.push(
      am5map.MapPolygonSeries.new(this.root, {
        geoJSON: am5geodata_worldLow,
      })
    );

    this.worldSeries.mapPolygons.template.setAll({
      interactive: true,
      fill: am5.color('#' + mempoolFeeColors[0]),
      templateField: "polygonSettings"
    });
  }

  ngOnDestroy(): void {
    this.root.dispose();
    this.subscription.unsubscribe();
  }
}
