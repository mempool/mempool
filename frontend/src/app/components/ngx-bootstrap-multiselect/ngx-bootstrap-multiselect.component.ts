import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  EventEmitter,
  forwardRef,
  Input,
  IterableDiffers,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';

import {
  AbstractControl,
  ControlValueAccessor,
  UntypedFormBuilder,
  UntypedFormControl,
  NG_VALUE_ACCESSOR,
  Validator,
} from '@angular/forms';

import { takeUntil } from 'rxjs/operators';
import { MultiSelectSearchFilter } from '@components/ngx-bootstrap-multiselect/search-filter.pipe';
import { IMultiSelectOption, IMultiSelectSettings, IMultiSelectTexts, } from '@components/ngx-bootstrap-multiselect/types';
import { Subject, Observable } from 'rxjs';

const MULTISELECT_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => NgxDropdownMultiselectComponent),
  multi: true,
};

// tslint:disable-next-line: no-conflicting-lifecycle
@Component({
  selector: 'ngx-bootstrap-multiselect',
  templateUrl: './ngx-bootstrap-multiselect.component.html',
  styleUrls: ['./ngx-bootstrap-multiselect.component.css'],
  providers: [MULTISELECT_VALUE_ACCESSOR, MultiSelectSearchFilter],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxDropdownMultiselectComponent implements OnInit,
  OnChanges,
  DoCheck,
  OnDestroy,
  ControlValueAccessor,
  Validator {

  private localIsVisible = false;
  private workerDocClicked = false;

  filterControl: UntypedFormControl = this.fb.control('');

  @Input() options: Array<IMultiSelectOption>;
  @Input() settings: IMultiSelectSettings;
  @Input() texts: IMultiSelectTexts;
  @Input() disabled = false;
  @Input() disabledSelection = false;
  @Input() searchFunction: (str: string) => RegExp = this._escapeRegExp;

  @Output() selectionLimitReached = new EventEmitter();
  @Output() dropdownClosed = new EventEmitter();
  @Output() dropdownOpened = new EventEmitter();
  @Output() added = new EventEmitter();
  @Output() removed = new EventEmitter();
  @Output() lazyLoad = new EventEmitter();
  @Output() filter: Observable<string> = this.filterControl.valueChanges;

  get focusBack(): boolean {
    return this.settings.focusBack && this._focusBack;
  }

  destroyed$ = new Subject<any>();

  filteredOptions: IMultiSelectOption[] = [];
  lazyLoadOptions: IMultiSelectOption[] = [];
  renderFilteredOptions: IMultiSelectOption[] = [];
  model: any[] = [];
  prevModel: any[] = [];
  parents: any[];
  title: string;
  differ: any;
  numSelected = 0;
  set isVisible(val: boolean) {
    this.localIsVisible = val;
    this.workerDocClicked = val ? false : this.workerDocClicked;
  }
  get isVisible(): boolean {
    return this.localIsVisible;
  }
  renderItems = true;
  checkAllSearchRegister = new Set();
  checkAllStatus = false;
  loadedValueIds = [];
  _focusBack = false;
  focusedItem: IMultiSelectOption | undefined;

  defaultSettings: IMultiSelectSettings = {
    closeOnClickOutside: true,
    pullRight: false,
    enableSearch: false,
    searchRenderLimit: 0,
    searchRenderAfter: 1,
    searchMaxLimit: 0,
    searchMaxRenderedItems: 0,
    checkedStyle: 'checkboxes',
    buttonClasses: 'btn btn-primary dropdown-toggle',
    containerClasses: 'dropdown-inline',
    selectionLimit: 0,
    minSelectionLimit: 0,
    closeOnSelect: false,
    autoUnselect: false,
    showCheckAll: false,
    showUncheckAll: false,
    fixedTitle: false,
    dynamicTitleMaxItems: 3,
    maxHeight: '300px',
    isLazyLoad: false,
    stopScrollPropagation: false,
    loadViewDistance: 1,
    selectAddedValues: false,
    ignoreLabels: false,
    maintainSelectionOrderInTitle: false,
    focusBack: true
  };
  defaultTexts: IMultiSelectTexts = {
    checkAll: 'Select all',
    uncheckAll: 'Unselect all',
    checked: 'selected',
    checkedPlural: 'selected',
    searchPlaceholder: 'Search...',
    searchEmptyResult: 'Nothing found...',
    searchNoRenderText: 'Type in search box to see results...',
    defaultTitle: 'Select',
    allSelected: 'All selected',
  };

  get searchLimit(): number | undefined {
    return this.settings.searchRenderLimit;
  }

  get searchRenderAfter(): number | undefined {
    return this.settings.searchRenderAfter;
  }

  get searchLimitApplied(): boolean {
    return this.searchLimit > 0 && this.options.length > this.searchLimit;
  }

  constructor(
    private fb: UntypedFormBuilder,
    private searchFilter: MultiSelectSearchFilter,
    differs: IterableDiffers,
    private cdRef: ChangeDetectorRef
  ) {
    this.differ = differs.find([]).create(null);
    this.settings = this.defaultSettings;
    this.texts = this.defaultTexts;
  }

  clickedOutside(): void {
    if (!this.isVisible || !this.settings.closeOnClickOutside) { return; }

    this.isVisible = false;
    this._focusBack = true;
    this.dropdownClosed.emit();
  }

  getItemStyle(option: IMultiSelectOption): any {
    const style = {};
    if (!option.isLabel) {
      style['cursor'] = 'pointer';
    }
    if (option.disabled) {
      style['cursor'] = 'default';
    }
  }

  getItemStyleSelectionDisabled(): any {
    if (this.disabledSelection) {
      return { cursor: 'default' };
    }
  }

  ngOnInit(): void {
    this.title = this.texts.defaultTitle || '';

    this.filterControl.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      this.updateRenderItems();
      if (this.settings.isLazyLoad) {
        this.load();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['options']) {
      this.options = this.options || [];
      this.parents = this.options
        .filter(option => typeof option.parentId === 'number')
        .map(option => option.parentId);
      this.updateRenderItems();

      if (
        this.settings.isLazyLoad &&
        this.settings.selectAddedValues &&
        this.loadedValueIds.length === 0
      ) {
        this.loadedValueIds = this.loadedValueIds.concat(
          changes.options.currentValue.map(value => value.id)
        );
      }
      if (
        this.settings.isLazyLoad &&
        this.settings.selectAddedValues &&
        changes.options.previousValue
      ) {
        const addedValues = changes.options.currentValue.filter(
          value => this.loadedValueIds.indexOf(value.id) === -1
        );
        this.loadedValueIds.concat(addedValues.map(value => value.id));
        if (this.checkAllStatus) {
          this.addChecks(addedValues);
        } else if (this.checkAllSearchRegister.size > 0) {
          this.checkAllSearchRegister.forEach((searchValue: string) =>
            this.addChecks(this.applyFilters(addedValues, searchValue))
          );
        }
      }

      if (this.texts) {
        this.updateTitle();
      }

      this.fireModelChange();
    }

    if (changes['settings']) {
      this.settings = { ...this.defaultSettings, ...this.settings };
    }

    if (changes['texts']) {
      this.texts = { ...this.defaultTexts, ...this.texts };
      if (!changes['texts'].isFirstChange()) { this.updateTitle(); }
    }
  }

  ngOnDestroy() {
    this.destroyed$.next(false);
  }

  updateRenderItems() {
    this.renderItems =
      !this.searchLimitApplied ||
      this.filterControl.value.length >= this.searchRenderAfter;
    this.filteredOptions = this.applyFilters(
      this.options,
      this.settings.isLazyLoad ? '' : this.filterControl.value
    );
    this.renderFilteredOptions = this.renderItems ? this.filteredOptions : [];
    this.focusedItem = undefined;
  }

  applyFilters(options: IMultiSelectOption[], value: string): IMultiSelectOption[] {
    return this.searchFilter.transform(
      options,
      value,
      this.settings.searchMaxLimit,
      this.settings.searchMaxRenderedItems,
      this.searchFunction
    );
  }

  fireModelChange(): void {
    if (this.model != this.prevModel) {
      this.prevModel = this.model;
      this.onModelChange(this.model);
      this.onModelTouched();
      this.cdRef.markForCheck();
    }
  }

  onModelChange: Function = (_: any) => { };
  onModelTouched: Function = () => { };

  writeValue(value: any): void {
    if (value !== undefined && value !== null) {
      this.model = Array.isArray(value) ? value : [value];
      this.ngDoCheck();
    } else {
      this.model = [];
    }
  }

  registerOnChange(fn: Function): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: Function): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  ngDoCheck() {
    const changes = this.differ.diff(this.model);
    if (changes) {
      this.updateNumSelected();
      this.updateTitle();
    }
  }

  validate(_c: AbstractControl): { [key: string]: any } {
    if (this.model && this.model.length) {
      return {
        required: {
          valid: false
        }
      };
    }

    if (this.options.filter(o => this.model.indexOf(o.id) && !o.disabled).length === 0) {
      return {
        selection: {
          valid: false
        }
      };
    }

    return null;
  }

  registerOnValidatorChange(_fn: () => void): void {
    throw new Error('Method not implemented.');
  }

  clearSearch(event: Event) {
    this.maybeStopPropagation(event);
    this.filterControl.setValue('');
  }

  toggleDropdown(e?: Event) {
    if (this.isVisible) {
      this._focusBack = true;
    }

    this.isVisible = !this.isVisible;
    this.isVisible ? this.dropdownOpened.emit() : this.dropdownClosed.emit();
    this.focusedItem = undefined;
  }

  closeDropdown(e?: Event) {
    this.isVisible = true;
    this.toggleDropdown(e);
  }

  isSelected(option: IMultiSelectOption): boolean {
    return this.model && this.model.indexOf(option.id) > -1;
  }

  setSelected(_event: Event, option: IMultiSelectOption) {
    if (option.isLabel) {
      return;
    }

    if (option.disabled) {
      return;
    }

    if (this.disabledSelection) {
      return;
    }

    setTimeout(() => {
      this.maybeStopPropagation(_event);
      this.maybePreventDefault(_event);
      const index = this.model.indexOf(option.id);
      const isAtSelectionLimit =
        this.settings.selectionLimit > 0 &&
        this.model.length >= this.settings.selectionLimit;
      const removeItem = (idx, id): void => {
        this.model.splice(idx, 1);
        this.removed.emit(id);
        if (
          this.settings.isLazyLoad &&
          this.lazyLoadOptions.some(val => val.id === id)
        ) {
          this.lazyLoadOptions.splice(
            this.lazyLoadOptions.indexOf(
              this.lazyLoadOptions.find(val => val.id === id)
            ),
            1
          );
        }
      };

      if (index > -1) {
        if (
          this.settings.minSelectionLimit === undefined ||
          this.numSelected > this.settings.minSelectionLimit
        ) {
          removeItem(index, option.id);
        }
        const parentIndex =
          option.parentId && this.model.indexOf(option.parentId);
        if (parentIndex > -1) {
          removeItem(parentIndex, option.parentId);
        } else if (this.parents.indexOf(option.id) > -1) {
          this.options
            .filter(
              child =>
                this.model.indexOf(child.id) > -1 &&
                child.parentId === option.id
            )
            .forEach(child =>
              removeItem(this.model.indexOf(child.id), child.id)
            );
        }
      } else if (isAtSelectionLimit && !this.settings.autoUnselect) {
        this.selectionLimitReached.emit(this.model.length);
        return;
      } else {
        const addItem = (id): void => {
          this.model.push(id);
          this.added.emit(id);
          if (
            this.settings.isLazyLoad &&
            !this.lazyLoadOptions.some(val => val.id === id)
          ) {
            this.lazyLoadOptions.push(option);
          }
        };

        addItem(option.id);
        if (!isAtSelectionLimit) {
          if (option.parentId && !this.settings.ignoreLabels) {
            const children = this.options.filter(
              child =>
                child.id !== option.id && child.parentId === option.parentId
            );
            if (children.every(child => this.model.indexOf(child.id) > -1)) {
              addItem(option.parentId);
            }
          } else if (this.parents.indexOf(option.id) > -1) {
            const children = this.options.filter(
              child =>
                this.model.indexOf(child.id) < 0 && child.parentId === option.id
            );
            children.forEach(child => addItem(child.id));
          }
        } else {
          removeItem(0, this.model[0]);
        }
      }
      if (this.settings.closeOnSelect) {
        this.toggleDropdown();
      }
      this.model = this.model.slice();
      this.fireModelChange();

    }, 0)
  }

  updateNumSelected() {
    this.numSelected =
      this.model.filter(id => this.parents.indexOf(id) < 0).length || 0;
  }

  updateTitle() {
    let numSelectedOptions = this.options.length;
    if (this.settings.ignoreLabels) {
      numSelectedOptions = this.options.filter(
        (option: IMultiSelectOption) => !option.isLabel
      ).length;
    }
    if (this.numSelected === 0 || this.settings.fixedTitle) {
      this.title = this.texts ? this.texts.defaultTitle : '';
    } else if (
      this.settings.displayAllSelectedText &&
      this.model.length === numSelectedOptions
    ) {
      this.title = this.texts ? this.texts.allSelected : '';
    } else if (
      this.settings.dynamicTitleMaxItems &&
      this.settings.dynamicTitleMaxItems >= this.numSelected
    ) {
      const useOptions =
        this.settings.isLazyLoad && this.lazyLoadOptions.length
          ? this.lazyLoadOptions
          : this.options;

      let titleSelections: Array<IMultiSelectOption>;

      if (this.settings.maintainSelectionOrderInTitle) {
        const optionIds = useOptions.map((selectOption: IMultiSelectOption, idx: number) => selectOption.id);
        titleSelections = this.model
          .map((selectedId) => optionIds.indexOf(selectedId))
          .filter((optionIndex) => optionIndex > -1)
          .map((optionIndex) => useOptions[optionIndex]);
      } else {
        titleSelections = useOptions.filter((option: IMultiSelectOption) => this.model.indexOf(option.id) > -1);
      }

      this.title = titleSelections.map((option: IMultiSelectOption) => option.name).join(', ');
    } else {
      this.title =
        this.numSelected +
        ' ' +
        (this.numSelected === 1
          ? this.texts.checked
          : this.texts.checkedPlural);
    }
    this.cdRef.markForCheck();
  }

  searchFilterApplied() {
    return (
      this.settings.enableSearch &&
      this.filterControl.value &&
      this.filterControl.value.length > 0
    );
  }

  addChecks(options) {
    const checkedOptions = options
      .filter((option: IMultiSelectOption) => {
        if (
          !option.disabled &&
          (
            this.model.indexOf(option.id) === -1 &&
            !(this.settings.ignoreLabels && option.isLabel)
          )
        ) {
          this.added.emit(option.id);
          return true;
        }
        return false;
      })
      .map((option: IMultiSelectOption) => option.id);

    this.model = this.model.concat(checkedOptions);
  }

  checkAll(): void {
    if (!this.disabledSelection) {
      this.addChecks(
        !this.searchFilterApplied() ? this.options : this.filteredOptions
      );
      if (this.settings.isLazyLoad && this.settings.selectAddedValues) {
        if (this.searchFilterApplied() && !this.checkAllStatus) {
          this.checkAllSearchRegister.add(this.filterControl.value);
        } else {
          this.checkAllSearchRegister.clear();
          this.checkAllStatus = true;
        }
        this.load();
      }
      this.fireModelChange();
    }
  }

  uncheckAll(): void {
    if (!this.disabledSelection) {
      const checkedOptions = this.model;
      let unCheckedOptions = !this.searchFilterApplied()
        ? this.model
        : this.filteredOptions.map((option: IMultiSelectOption) => option.id);
      // set unchecked options only to the ones that were checked
      unCheckedOptions = checkedOptions.filter(item => unCheckedOptions.indexOf(item) > -1);
      this.model = this.model.filter((id: number) => {
        if (
          (unCheckedOptions.indexOf(id) < 0 &&
            this.settings.minSelectionLimit === undefined) ||
          unCheckedOptions.indexOf(id) < this.settings.minSelectionLimit
        ) {
          return true;
        } else {
          this.removed.emit(id);
          return false;
        }
      });
      if (this.settings.isLazyLoad && this.settings.selectAddedValues) {
        if (this.searchFilterApplied()) {
          if (this.checkAllSearchRegister.has(this.filterControl.value)) {
            this.checkAllSearchRegister.delete(this.filterControl.value);
            this.checkAllSearchRegister.forEach(function(searchTerm) {
              const filterOptions = this.applyFilters(this.options.filter(option => unCheckedOptions.indexOf(option.id) > -1), searchTerm);
              this.addChecks(filterOptions);
            });
          }
        } else {
          this.checkAllSearchRegister.clear();
          this.checkAllStatus = false;
        }
        this.load();
      }
      this.fireModelChange();
    }
  }

  preventCheckboxCheck(event: Event, option: IMultiSelectOption): void {
    if (
      option.disabled ||
      (
        this.settings.selectionLimit &&
        !this.settings.autoUnselect &&
        this.model.length >= this.settings.selectionLimit &&
        this.model.indexOf(option.id) === -1 &&
        this.maybePreventDefault(event)
      )
    ) {
      this.maybePreventDefault(event);
    }
  }

  isCheckboxDisabled(option?: IMultiSelectOption): boolean {
    return this.disabledSelection || option && option.disabled;
  }

  checkScrollPosition(ev): void {
    const scrollTop = ev.target.scrollTop;
    const scrollHeight = ev.target.scrollHeight;
    const scrollElementHeight = ev.target.clientHeight;
    const roundingPixel = 1;
    const gutterPixel = 1;

    if (
      scrollTop >=
      scrollHeight -
      (1 + this.settings.loadViewDistance) * scrollElementHeight -
      roundingPixel -
      gutterPixel
    ) {
      this.load();
    }
  }

  checkScrollPropagation(ev, element): void {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const scrollElementHeight = element.clientHeight;

    if (
      (ev.deltaY > 0 && scrollTop + scrollElementHeight >= scrollHeight) ||
      (ev.deltaY < 0 && scrollTop <= 0)
    ) {
      ev = ev || window.event;
      this.maybePreventDefault(ev);
      ev.returnValue = false;
    }
  }

  trackById(idx: number, selectOption: IMultiSelectOption): void {
    return selectOption.id;
  }

  load(): void {
    this.lazyLoad.emit({
      length: this.options.length,
      filter: this.filterControl.value,
      checkAllSearches: this.checkAllSearchRegister,
      checkAllStatus: this.checkAllStatus,
    });
  }

  focusItem(dir: number, e?: Event): void {
    if (!this.isVisible) {
      return;
    }

    this.maybePreventDefault(e);

    const idx = this.filteredOptions.indexOf(this.focusedItem);

    if (idx === -1) {
      this.focusedItem = this.filteredOptions[0];
      return;
    }

    const nextIdx = idx + dir;
    const newIdx =
      nextIdx < 0
        ? this.filteredOptions.length - 1
        : nextIdx % this.filteredOptions.length;

    this.focusedItem = this.filteredOptions[newIdx];
  }

  private maybePreventDefault(e?: Event): void {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
  }

  private maybeStopPropagation(e?: Event): void {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  }

  private _escapeRegExp(str: string): RegExp {
    const regExpStr = str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
    return new RegExp(regExpStr, 'i');
  }
}
