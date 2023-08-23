import { Component, OnInit, Output, EventEmitter, HostListener } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { MenuGroup } from '../../interfaces/services.interface';
import { StorageService } from '../../services/storage.service';
import { Router, NavigationStart } from '@angular/router';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})

export class MenuComponent implements OnInit {
  @Output() loggedOut = new EventEmitter<boolean>();

  navOpen: boolean = false;
  userMenuGroups$: Observable<MenuGroup[]> | undefined;
  userAuth: any | undefined;
  isServicesPage = false;

  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private router: Router,
    private stateService: StateService
  ) {}

  ngOnInit(): void {
    this.userAuth = this.storageService.getAuth();
    if (this.stateService.env.GIT_COMMIT_HASH_MEMPOOL_SPACE) {
      this.userMenuGroups$ = this.apiService.getUserMenuGroups$();
    }

    this.isServicesPage = this.router.url.includes('/services/');
    this.navOpen = this.isServicesPage && !this.isSmallScreen();

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        if (!this.isServicesPage) {
          this.navOpen = false;
        }
      }
    });
  }

  isSmallScreen() {
    return window.innerWidth <= 767.98;
  }

  logout(): void {
    this.apiService.logout$().subscribe(() => {
      this.loggedOut.emit(true);
      if (this.stateService.env.GIT_COMMIT_HASH_MEMPOOL_SPACE) {
        this.userMenuGroups$ = this.apiService.getUserMenuGroups$();
        this.router.navigateByUrl('/');
      }
    });
  }

  onLinkClick(link) {
    if (!this.isServicesPage || this.isSmallScreen()) {
      this.navOpen = false;
    }
    this.router.navigateByUrl(link);
  }

  hamburgerClick() {
    this.navOpen = !this.navOpen;
    this.stateService.menuOpen$.next(this.navOpen);
  }

  @HostListener('window:click', ['$event'])
  onClick(event) {
    const isServicesPageOnMobile = this.isServicesPage && this.isSmallScreen();
    const cssClasses = event.target.className;

    if (!cssClasses.indexOf) { // Click on chart or non html thingy, close the menu
      if (!this.isServicesPage || isServicesPageOnMobile) {
        this.navOpen = false;
      }
      return;
    }

    const isHamburger = cssClasses.indexOf('profile_image') !== -1;
    const isMenu = cssClasses.indexOf('menu-click') !== -1;
    if (!isHamburger && !isMenu && (!this.isServicesPage || isServicesPageOnMobile)) {
      this.navOpen = false;
      return;
    }
  }
}
