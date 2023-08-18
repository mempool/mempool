import { Component, OnInit, Output, EventEmitter } from '@angular/core';
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
  @Output() loggedOut = new EventEmitter<boolean>();

  constructor(
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.userAuth = JSON.parse(localStorage.getItem('auth') || '') ?? null;
    this.userMenuGroups$ = this.apiService.getUserMenuGroups$();
  }

  logout(): void {
    this.apiService.logout$().subscribe();
    this.loggedOut.emit(true);
  }

  hambugerClick() {
    this.navOpen = !this.navOpen;
  }
}
