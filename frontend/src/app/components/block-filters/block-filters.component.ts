import { Component, EventEmitter, Output, HostListener, Input, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { FilterGroups, TransactionFilters } from '../../shared/filters.utils';


@Component({
  selector: 'app-block-filters',
  templateUrl: './block-filters.component.html',
  styleUrls: ['./block-filters.component.scss'],
})
export class BlockFiltersComponent implements OnChanges {
  @Input() cssWidth: number = 800;
  @Output() onFilterChanged: EventEmitter<bigint | null> = new EventEmitter();

  filters = TransactionFilters;
  filterGroups = FilterGroups;
  activeFilters: string[] = [];
  filterFlags: { [key: string]: boolean } = {};
  menuOpen: boolean = false;

  constructor(
    private cd: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.cssWidth) {
      this.cd.markForCheck();
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
    this.onFilterChanged.emit(this.getBooleanFlags());
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
}