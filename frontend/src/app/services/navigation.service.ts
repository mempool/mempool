import { Injectable } from '@angular/core';
import { Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  subnetPaths = new BehaviorSubject<Record<string,string>>({});
  networkModules = {
    bitcoin: {
      subnets: [
        { name: 'mainnet', path: '' },
        { name: 'testnet', path: this.stateService.env.ROOT_NETWORK === 'testnet' ? '/' : '/testnet' },
        { name: 'testnet4', path: this.stateService.env.ROOT_NETWORK === 'testnet4' ? '/' : '/testnet4' },
        { name: 'signet', path: this.stateService.env.ROOT_NETWORK === 'signet' ? '/' : '/signet' },
      ],
    },
    liquid: {
      subnets: [
        { name: 'liquid', path: '' },
        { name: 'liquidtestnet', path: '/testnet' },
      ],
    }
  };
  networks = Object.keys(this.networkModules);
  initialLoad = true;

  constructor(
    private stateService: StateService,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.routerState.snapshot.root),
    ).subscribe((state) => {
      if (this.enforceSubnetRestrictions(state)) {
        this.updateSubnetPaths(state);
      }
      if (this.initialLoad) {
        this.initialLoad = false;
      }
      this.updateSubnetPaths(state);
    });
  }

  enforceSubnetRestrictions(root: ActivatedRouteSnapshot): boolean {
    let route = root;
    while (route) {
      if (route.data.onlySubnet && !route.data.onlySubnet.includes(this.stateService.network)) {
        this.router.navigate([this.relativeUrlPipe.transform('')]);
        return false;
      }
      route = route.firstChild;
    }
    return true;
  }

  // For each network (bitcoin/liquid), find and save the longest url path compatible with the current route
  updateSubnetPaths(root: ActivatedRouteSnapshot): void {
    let path = '';
    const networkPaths = {};
    let route = root;
    // traverse the router state tree until all network paths are set, or we reach the end of the tree
    while (!this.networks.reduce((acc, network) => acc && !!networkPaths[network], true) && route) {
      // 'networkSpecific' paths may correspond to valid routes on other networks, but aren't directly compatible
      // (e.g. we shouldn't link a mainnet transaction page to the same txid on testnet or liquid)
      if (route.data?.networkSpecific) {
        this.networks.forEach(network => {
          if (networkPaths[network] == null) {
            networkPaths[network] = path;
          }
        });
      }
      // null or empty networks list is shorthand for "compatible with every network"
      if (route.data?.networks?.length) {
        // if the list is non-empty, only those networks are compatible
        this.networks.forEach(network => {
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
    Object.entries(this.networkModules).forEach(([key, network]) => {
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
