import { Component, EventEmitter, Output, HostListener, Input, ChangeDetectorRef, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { ActiveFilter, FilterGroups, FilterMode, GradientMode, TransactionFilters } from '@app/shared/filters.utils';
import { StateService } from '@app/services/state.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-block-filters',
  templateUrl: './block-filters.component.html',
  styleUrls: ['./block-filters.component.scss'],
})
export class BlockFiltersComponent implements OnInit, OnChanges, OnDestroy {
  @Input() cssWidth: number = 800;
  @Input() excludeFilters: string[] = [];
  @Output() onFilterChanged: EventEmitter<ActiveFilter | null> = new EventEmitter();

  filterSubscription: Subscription;

  filters = TransactionFilters;
  filterGroups = FilterGroups;
  disabledFilters: { [key: string]: boolean } = {};
  activeFilters: string[] = [];
  filterFlags: { [key: string]: boolean } = {};
  filterMode: FilterMode = 'and';
  gradientMode: GradientMode = 'fee';
  menuOpen: boolean = false;

  constructor(
    private stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.filterSubscription = this.stateService.activeGoggles$.subscribe((active: ActiveFilter) => {
      this.filterMode = active.mode;
      this.gradientMode = active.gradient;
      for (const key of Object.keys(this.filterFlags)) {
        this.filterFlags[key] = false;
      }
      for (const key of active.filters) {
        this.filterFlags[key] = !this.disabledFilters[key];
      }
      this.activeFilters = [...active.filters.filter(key => !this.disabledFilters[key])];
      this.onFilterChanged.emit({ mode: active.mode, filters: this.activeFilters, gradient: this.gradientMode });
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

  setFilterMode(mode): void {
    this.filterMode = mode;
    this.onFilterChanged.emit({ mode: this.filterMode, filters: this.activeFilters, gradient: this.gradientMode });
    this.stateService.activeGoggles$.next({ mode: this.filterMode, filters: [...this.activeFilters], gradient: this.gradientMode });
  }

  setGradientMode(mode): void {
    this.gradientMode = mode;
    this.onFilterChanged.emit({ mode: this.filterMode, filters: this.activeFilters, gradient: this.gradientMode });
    this.stateService.activeGoggles$.next({ mode: this.filterMode, filters: [...this.activeFilters], gradient: this.gradientMode });
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
    this.onFilterChanged.emit({ mode: this.filterMode, filters: this.activeFilters, gradient: this.gradientMode });
    this.stateService.activeGoggles$.next({ mode: this.filterMode, filters: [...this.activeFilters], gradient: this.gradientMode });
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
    if (!event.target.closest('button') && !event.target.closest('label')) {
      this.menuOpen = false;
    }
    return true;
  }

  ngOnDestroy(): void {
    this.filterSubscription.unsubscribe();
  }
}
