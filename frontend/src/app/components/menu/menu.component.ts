import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { MenuGroup } from '../../interfaces/services.interface';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})

export class MenuComponent implements OnInit {
  navOpen: boolean = true;
  userMenuGroups$: Observable<MenuGroup[]> | undefined;

  constructor(
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.userMenuGroups$ = this.apiService.getUserMenuGroups$();
  }
}
