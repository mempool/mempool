import { Component, OnInit, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { MenuGroup } from '../../interfaces/services.interface';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})

export class MenuComponent implements OnInit {
  navOpen: boolean = false;
  userMenuGroups$: Observable<MenuGroup[]> | undefined;
  userAuth: any | undefined;

  constructor(
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.userAuth = JSON.parse(localStorage.getItem('auth') || '') ?? null;
    this.userMenuGroups$ = this.apiService.getUserMenuGroups$();
  }

  logout(): void {
    this.apiService.logout$().subscribe();
  }

  hambugerClick() {
    this.navOpen = !this.navOpen;
  }
}
