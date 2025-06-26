import { Component, Input, SecurityContext, SimpleChanges, OnChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ServicesApiServices } from '@app/services/services-api.service';
import { catchError, of } from 'rxjs';

export interface SimpleProofCubo {
  student_name: string;
  id_code: string;
  download_url: string;
  simpleproof_url: string;
  sanitized_download_url: SafeResourceUrl;
  sanitized_simpleproof_url: SafeResourceUrl;
  parsed?: { type: string; year: number; studentNumber: number };
}

@Component({
  selector: 'app-simpleproof-cubo-widget',
  templateUrl: './simpleproof-cubo-widget.component.html',
  styleUrls: ['./simpleproof-widget.component.scss'],
})
export class SimpleProofCuboWidgetComponent implements OnChanges {
  @Input() key: string = window['__env']?.customize?.dashboard.widgets?.find(w => w.component ==='simpleproof_cubo')?.props?.key ?? '';
  @Input() label: string = window['__env']?.customize?.dashboard.widgets?.find(w => w.component ==='simpleproof_cubo')?.props?.label ?? 'CUBO+ Certificates';
  @Input() widget: boolean = false;
  @Input() width = 300;
  @Input() height = 400;

  searchText: string = '';
  verified: SimpleProofCubo[] = [];
  filteredVerified: SimpleProofCubo[] = [];
  verifiedPage: SimpleProofCubo[] = [];
  isLoading: boolean = true;
  error: boolean = false;
  page = 1;
  lastPage = 1;
  itemsPerPage = 15;
  paginationMaxSize = window.innerWidth <= 767.98 ? 3 : 5;

  constructor(
    private servicesApiService: ServicesApiServices,
    public sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.loadVerifications();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.widget) {
      this.itemsPerPage = this.widget ? 5 : 15;
    }
    if (changes.key) {
      this.loadVerifications();
    }
  }

  loadVerifications(): void {
    if (this.key) {
      this.isLoading = true;
      this.servicesApiService.getSimpleProofs$(this.key).pipe(
        catchError(() => {
          this.isLoading = false;
          this.error = true;
          return of({});
        }),
      ).subscribe((data: Record<string, SimpleProofCubo>) => {
        if (Object.keys(data).length) {
          const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
          this.verified = Object.keys(data).map(key => ({
            ...data[key],
            key,
            parsed: this.parseCuboKey(key),
            sanitized_download_url: data[key]['download_url']?.length ? this.sanitizer.bypassSecurityTrustResourceUrl(this.sanitizer.sanitize(SecurityContext.URL, data[key]['download_url']) ?? '') : null,
            sanitized_simpleproof_url: data[key]['simpleproof_url']?.length ? this.sanitizer.bypassSecurityTrustResourceUrl(this.sanitizer.sanitize(SecurityContext.URL, data[key]['simpleproof_url']) ?? '') : null,
          })).sort((a, b) => {
            // smarter sorting using the specific Cubo ID format, where possible
            if (a.parsed && b.parsed) {
              if (a.parsed.year !== b.parsed.year) {
                return b.parsed.year - a.parsed.year;
              }
              if (a.parsed.type !== b.parsed.type) {
                return a.parsed.type.localeCompare(b.parsed.type);
              }
              return a.parsed.studentNumber - b.parsed.studentNumber;
            }
            // fallback to lexicographic sorting
            if (!a.parsed && !b.parsed) {
              return collator.compare(b.key, a.key);
            }
            return a.parsed ? -1 : 1;
          });
          this.applyFilter();
          this.isLoading = false;
          this.error = false;
        }
      });
    }
  }

  parseCuboKey(key: string): { type: string; year: number; studentNumber: number } | null {
    const match = key.match(/^Cubo\+([A-Za-z]*)(\d{4})-(\d+)$/);
    if (!match) {
      return null;
    }
    const [, type, yearStr, studentNumberStr] = match;
    return {
      type: type || '',
      year: parseInt(yearStr, 10),
      studentNumber: parseInt(studentNumberStr, 10)
    };
  }

  applyFilter(event?: Event): void {
    let searchText = '';
    if (event) {
      searchText = (event.target as HTMLInputElement).value;
    }
    if (searchText?.length > 0) {
      this.filteredVerified = this.verified.filter(item =>
        item.student_name.toLowerCase().includes(searchText.toLowerCase()) || item.id_code.toLowerCase().includes(searchText.toLowerCase())
      );
    } else {
      this.filteredVerified = this.verified;
    }
    this.page = 1;
    this.updatePage();
  }

  updatePage(): void {
    this.verifiedPage = this.filteredVerified.slice((this.page - 1) * this.itemsPerPage, this.page * this.itemsPerPage);
  }

  pageChange(page: number): void {
    this.page = page;
    this.updatePage();
  }
}
