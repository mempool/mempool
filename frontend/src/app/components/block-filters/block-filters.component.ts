import { Component, EventEmitter, Output, HostListener, Input, ChangeDetectorRef, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { FilterGroups, TransactionFilters } from '../../shared/filters.utils';
import { StateService } from '../../services/state.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-block-filters',
  templateUrl: './block-filters.component.html',
  styleUrls: ['./block-filters.component.scss'],
})
export class BlockFiltersComponent implements OnInit, OnChanges, OnDestroy {
  @Input() cssWidth: number = 800;
  @Input() excludeFilters: string[] = [];
  @Output() onFilterChanged: EventEmitter<bigint | null> = new EventEmitter();

  filterSubscription: Subscription;

  filters = TransactionFilters;
  filterGroups = FilterGroups;
  disabledFilters: { [key: string]: boolean } = {};
  activeFilters: string[] = [];
  filterFlags: { [key: string]: boolean } = {};
  menuOpen: boolean = false;

  constructor(
    private stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.filterSubscription = this.stateService.activeGoggles$.subscribe((activeFilters: string[]) => {
      for (const key of Object.keys(this.filterFlags)) {
        this.filterFlags[key] = false;
      }
      for (const key of activeFilters) {
        this.filterFlags[key] = !this.disabledFilters[key];
      }
      this.activeFilters = [...activeFilters.filter(key => !this.disabledFilters[key])];
      this.onFilterChanged.emit(this.getBooleanFlags());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.cssWidth) {
      this.cd.markForCheck();
    }
    if (changes.excludeFilters) {
      this.disabledFilters = {};
      this.excludeFilters.forEach(filter => {
        this.disabledFilters[filter] = true;
      });
    }
  }

  toggleFilter(key): void {
    const filter = this.filters[key];
    this.filterFlags[key] = !this.filterFlags[key];
    if (this.filterFlags[key]) {
      // remove any other flags in the same toggle group
      if (filter.toggle) {
        this.activeFilters.forEach(f => {
          if (this.filters[f].toggle === filter.toggle) {
            this.filterFlags[f] = false;
          }
        });
        this.activeFilters = this.activeFilters.filter(f => this.filters[f].toggle !== filter.toggle);
      }
      // add new active filter
      this.activeFilters.push(key);
    } else {
      // remove active filter
      this.activeFilters = this.activeFilters.filter(f => f != key);
    }
    const booleanFlags = this.getBooleanFlags();
    this.onFilterChanged.emit(booleanFlags);
    this.stateService.activeGoggles$.next([...this.activeFilters]);
  }
  
  getBooleanFlags(): bigint | null {
    let flags = 0n;
    for (const key of Object.keys(this.filterFlags)) {
      if (this.filterFlags[key]) {
        flags |= this.filters[key].flag;
      }
    }
    return flags || null;
  }

  @HostListener('document:click', ['$event'])
  onClick(event): boolean {
    // click away from menu
    if (!event.target.closest('button')) {
      this.menuOpen = false;
    }
    return true;
  }

  ngOnDestroy(): void {
    this.filterSubscription.unsubscribe();
  }
}