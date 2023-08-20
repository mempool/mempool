import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { MenuGroup } from '../../interfaces/services.interface';
import { StorageService } from '../../services/storage.service';
import { Router } from '@angular/router';

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
  isServices = false;

  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userAuth = this.storageService.getAuth();
    this.userMenuGroups$ = this.apiService.getUserMenuGroups$();

    this.isServices = this.router.url.includes('/services/');
    this.navOpen = this.isServices && !this.isSmallScreen();
  }

  isSmallScreen() {
    return window.innerWidth <= 767.98;
  }

  logout(): void {
    this.apiService.logout$().subscribe();
    this.loggedOut.emit(true);
  }

  onLinkClick() {
    if (!this.isServices || this.isSmallScreen()) {
      this.navOpen = false;
    }
  }

  hambugerClick() {
    this.navOpen = !this.navOpen;
  }
}
