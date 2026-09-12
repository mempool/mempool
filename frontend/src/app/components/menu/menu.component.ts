import { Component, OnInit, Input, Output, EventEmitter, HostListener, OnDestroy } from '@angular/core';
import { Observable, of, Subscription } from 'rxjs';
import { MenuGroup } from '@interfaces/services.interface';
import { Router, NavigationStart } from '@angular/router';
import { StateService } from '@app/services/state.service';
import { IUser, ServicesApiServices } from '@app/services/services-api.service';
import { AuthServiceMempool } from '@app/services/auth.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  standalone: false,
})

export class MenuComponent implements OnInit, OnDestroy {
  @Input() navOpen: boolean = false;
  @Output() loggedOut = new EventEmitter<boolean>();
  @Output() menuToggled = new EventEmitter<boolean>();

  userMenuGroups$: Observable<MenuGroup[]> | undefined;
  user$: Observable<IUser | null>;
  userAuth: any | undefined;
  isServicesPage = false;
  authSubscription$: Subscription;

  constructor(
    private servicesApiServices: ServicesApiServices,
    private router: Router,
    private stateService: StateService,
    private authService: AuthServiceMempool
  ) {}

  ngOnInit(): void {
    if (this.stateService.env.GIT_COMMIT_HASH_MEMPOOL_SPACE) {
      this.user$ = this.servicesApiServices.userSubject$;
      this.authSubscription$ = this.authService.getAuth$().subscribe((auth) => {
        this.userAuth = auth;
        this.userMenuGroups$ = auth ? this.servicesApiServices.getUserMenuGroups$() : of([]);
      });
    }

    this.isServicesPage = this.router.url.includes('/services/');
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        if (!this.isServicesPage) {
          this.toggleMenu(false);
        }
      }
    });
  }

  toggleMenu(toggled: boolean) {
    this.navOpen = toggled;
    this.menuToggled.emit(toggled);
  }

  isSmallScreen() {
    return window.innerWidth <= 767.98;
  }

  logout(): void {
    this.servicesApiServices.logout$().subscribe(() => {
      this.loggedOut.emit(true);
      if (this.stateService.env.GIT_COMMIT_HASH_MEMPOOL_SPACE) {
        this.userMenuGroups$ = this.servicesApiServices.getUserMenuGroups$();
        this.authService.logout();
        if (window.location.toString().includes('/services/')) {
          this.router.navigateByUrl('/');
        }
      }
    });
  }

  onLinkClick(link) {
    if (link === 'logout') {
      this.toggleMenu(false);
      return;
    }
    if (!this.isServicesPage || this.isSmallScreen()) {
      this.toggleMenu(false);
    }
    this.router.navigateByUrl(link);
  }

  hamburgerClick() {
    this.toggleMenu(!this.navOpen);
    this.stateService.menuOpen$.next(this.navOpen);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    if (this.isSmallScreen()) {
      this.toggleMenu(false);
    } else if (this.isServicesPage) {
      this.toggleMenu(true);
    }
  }

  @HostListener('window:click', ['$event'])
  onClick(event) {
    const isServicesPageOnMobile = this.isServicesPage && this.isSmallScreen();
    const cssClasses = event.target.className;

    if (!cssClasses.indexOf) { // Click on chart or non html thingy, close the menu
      if (!this.isServicesPage || isServicesPageOnMobile) {
        this.toggleMenu(false);
      }
      return;
    }

    const isHamburger = cssClasses.indexOf('profile_image') !== -1;
    const isMenu = cssClasses.indexOf('menu-click') !== -1;
    if (!isHamburger && !isMenu && (!this.isServicesPage || isServicesPageOnMobile)) {
      this.toggleMenu(false);
    }
  }

  ngOnDestroy(): void {
    if (this.authSubscription$) {
      this.authSubscription$.unsubscribe();
    }
    this.stateService.menuOpen$.next(false);
  }
}
