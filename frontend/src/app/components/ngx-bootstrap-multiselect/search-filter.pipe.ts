import { Pipe, PipeTransform } from '@angular/core';
import { IMultiSelectOption } from '@components/ngx-bootstrap-multiselect/types';

interface StringHashMap<T> {
  [k: string]: T;
}

@Pipe({
  name: 'searchFilter'
})
export class MultiSelectSearchFilter implements PipeTransform {

  private _lastOptions: IMultiSelectOption[];
  private _searchCache: StringHashMap<IMultiSelectOption[]> = {};
  private _searchCacheInclusive: StringHashMap<boolean | number> = {};
  private _prevSkippedItems: StringHashMap<number> = {};

  transform(
    options: IMultiSelectOption[],
    str = '',
    limit = 0,
    renderLimit = 0,
    searchFunction: (str: string) => RegExp,
  ): IMultiSelectOption[] {
    str = str.toLowerCase();

    // Drop cache because options were updated
    if (options !== this._lastOptions) {
      this._lastOptions = options;
      this._searchCache = {};
      this._searchCacheInclusive = {};
      this._prevSkippedItems = {};
    }

    const filteredOpts = this._searchCache.hasOwnProperty(str)
      ? this._searchCache[str]
      : this._doSearch(options, str, limit, searchFunction);

    const isUnderLimit = options.length <= limit;

    return isUnderLimit
      ? filteredOpts
      : this._limitRenderedItems(filteredOpts, renderLimit);
  }

  private _getSubsetOptions(
    options: IMultiSelectOption[],
    prevOptions: IMultiSelectOption[],
    prevSearchStr: string
  ) {
    const prevInclusiveOrIdx = this._searchCacheInclusive[prevSearchStr];

    if (prevInclusiveOrIdx === true) {
      // If have previous results and it was inclusive, do only subsearch
      return prevOptions;
    } else if (typeof prevInclusiveOrIdx === 'number') {
      // Or reuse prev results with unchecked ones
      return [...prevOptions, ...options.slice(prevInclusiveOrIdx)];
    }

    return options;
  }

  private _doSearch(options: IMultiSelectOption[], str: string, limit: number, searchFunction: (str: string) => RegExp) {
    const prevStr = str.slice(0, -1);
    const prevResults = this._searchCache[prevStr];
    const prevResultShift = this._prevSkippedItems[prevStr] || 0;

    if (prevResults) {
      options = this._getSubsetOptions(options, prevResults, prevStr);
    }

    const optsLength = options.length;
    const maxFound = limit > 0 ? Math.min(limit, optsLength) : optsLength;
    const regexp = searchFunction(str);
    const filteredOpts: IMultiSelectOption[] = [];

    let i = 0, founded = 0, removedFromPrevResult = 0;

    const doesOptionMatch = (option: IMultiSelectOption) => regexp.test(option.name);
    const getChildren = (option: IMultiSelectOption) =>
      options.filter(child => child.parentId === option.id);
    const getParent = (option: IMultiSelectOption) =>
      options.find(parent => option.parentId === parent.id);
    const foundFn = (item: any) => { filteredOpts.push(item); founded++; };
    const notFoundFn = prevResults ? () => removedFromPrevResult++ : () => { };

    for (; i < optsLength && founded < maxFound; ++i) {
      const option = options[i];
      const directMatch = doesOptionMatch(option);

      if (directMatch) {
        foundFn(option);
        continue;
      }

      if (typeof option.parentId === 'undefined') {
        const childrenMatch = getChildren(option).some(doesOptionMatch);

        if (childrenMatch) {
          foundFn(option);
          continue;
        }
      }

      if (typeof option.parentId !== 'undefined') {
        const parentMatch = doesOptionMatch(getParent(option));

        if (parentMatch) {
          foundFn(option);
          continue;
        }
      }

      notFoundFn();
    }

    const totalIterations = i + prevResultShift;

    this._searchCache[str] = filteredOpts;
    this._searchCacheInclusive[str] = i === optsLength || totalIterations;
    this._prevSkippedItems[str] = removedFromPrevResult + prevResultShift;

    return filteredOpts;
  }

  private _limitRenderedItems<T>(items: T[], limit: number): T[] {
    return items.length > limit && limit > 0 ? items.slice(0, limit) : items;
  }
}
