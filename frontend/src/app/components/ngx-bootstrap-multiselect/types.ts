export interface IMultiSelectOption {
  id: any;
  name: string;
  disabled?: boolean;
  isLabel?: boolean;
  parentId?: any;
  params?: any;
  classes?: string;
  image?: string;
}

export interface IMultiSelectSettings {
  pullRight?: boolean;
  enableSearch?: boolean;
  closeOnClickOutside?: boolean;
  /**
   * 0 - By default
   * If `enableSearch=true` and total amount of items more then `searchRenderLimit` (0 - No limit)
   * then render items only when user typed more then or equal `searchRenderAfter` charachters
   */
  searchRenderLimit?: number;
  /**
   * 3 - By default
   */
  searchRenderAfter?: number;
  /**
   * 0 - By default
   * If >0 will render only N first items
   */
  searchMaxLimit?: number;
  /**
   * 0 - By default
   * Used with searchMaxLimit to further limit rendering for optimization
   * Should be less than searchMaxLimit to take effect
   */
  searchMaxRenderedItems?: number;
  checkedStyle?: 'checkboxes' | 'glyphicon' | 'fontawesome' | 'visual';
  buttonClasses?: string;
  itemClasses?: string;
  containerClasses?: string;
  selectionLimit?: number;
  minSelectionLimit?: number;
  closeOnSelect?: boolean;
  autoUnselect?: boolean;
  showCheckAll?: boolean;
  showUncheckAll?: boolean;
  fixedTitle?: boolean;
  dynamicTitleMaxItems?: number;
  maxHeight?: string;
  displayAllSelectedText?: boolean;
  isLazyLoad?: boolean;
  loadViewDistance?: number;
  stopScrollPropagation?: boolean;
  selectAddedValues?: boolean;
  /**
   * false - By default
   * If activated label IDs don't count and won't be written to the model.
   */
  ignoreLabels?: boolean;
  /**
   * false - By default
   * If activated, the title will show selections in the order they were selected.
   */
  maintainSelectionOrderInTitle?: boolean;
  /**
   * @default true
   * Set the focus back to the input control when the dropdown closed
   */
  focusBack?: boolean;
}

export interface IMultiSelectTexts {
  checkAll?: string;
  uncheckAll?: string;
  checked?: string;
  checkedPlural?: string;
  searchPlaceholder?: string;
  searchEmptyResult?: string;
  searchNoRenderText?: string;
  defaultTitle?: string;
  allSelected?: string;
}
