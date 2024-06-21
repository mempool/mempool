import { Injectable } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StateService } from './state.service';

const networkModules = {
  bitcoin: {
    subnets: [
      { name: 'mainnet', path: '' },
      { name: 'testnet', path: '/testnet' },
      { name: 'testnet4', path: '/testnet4' },
      { name: 'signet', path: '/signet' },
    ],
  },
  liquid: {
    subnets: [
      { name: 'liquid', path: '' },
      { name: 'liquidtestnet', path: '/testnet' },
    ],
  }
};
const networks = Object.keys(networkModules);

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  subnetPaths = new BehaviorSubject<Record<string,string>>({});
  initialLoad = true;

  constructor(
    private stateService: StateService,
    private router: Router,
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.routerState.snapshot.root),
    ).subscribe((state) => {
      if (this.initialLoad) {
        this.initialLoad = false;
      }
      this.updateSubnetPaths(state);
    });
  }

  // For each network (bitcoin/liquid), find and save the longest url path compatible with the current route
  updateSubnetPaths(root: ActivatedRouteSnapshot): void {
    let path = '';
    const networkPaths = {};
    let route = root;
    // traverse the router state tree until all network paths are set, or we reach the end of the tree
    while (!networks.reduce((acc, network) => acc && !!networkPaths[network], true) && route) {
      // 'networkSpecific' paths may correspond to valid routes on other networks, but aren't directly compatible
      // (e.g. we shouldn't link a mainnet transaction page to the same txid on testnet or liquid)
      if (route.data?.networkSpecific) {
        networks.forEach(network => {
          if (networkPaths[network] == null) {
            networkPaths[network] = path;
          }
        });
      }
      // null or empty networks list is shorthand for "compatible with every network"
      if (route.data?.networks?.length) {
        // if the list is non-empty, only those networks are compatible
        networks.forEach(network => {
          if (!route.data.networks.includes(network)) {
            if (networkPaths[network] == null) {
              networkPaths[network] = path;
            }
          }
        });
      }
      if (route.url?.length) {
        path = [path, ...route.url.map(segment => segment.path).filter(path => {
          return path.length && !['testnet', 'testnet4', 'signet'].includes(path);
        })].join('/');
      }
      route = route.firstChild;
    }

    const subnetPaths = {};
    Object.entries(networkModules).forEach(([key, network]) => {
      network.subnets.forEach(subnet => {
        subnetPaths[subnet.name] = subnet.path + (networkPaths[key] != null ? networkPaths[key] : path);
      });
    });
    this.subnetPaths.next(subnetPaths);
  }

  isInitialLoad(): boolean {
    return this.initialLoad;
  }
}
