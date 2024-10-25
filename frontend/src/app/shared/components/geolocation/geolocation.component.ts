import { Component, Input, OnChanges } from '@angular/core';
import { convertRegion, getFlagEmoji } from '@app/shared/common.utils';

export interface GeolocationData {
  country: string;
  city: string;
  subdivision: string;
  iso: string;
}

@Component({
  selector: 'app-geolocation',
  templateUrl: './geolocation.component.html',
  styleUrls: ['./geolocation.component.scss']
})
export class GeolocationComponent implements OnChanges {
  @Input() data: GeolocationData;
  @Input() type: 'node' | 'list-isp' | 'list-country';

  formattedLocation: string = '';

  ngOnChanges(): void {
    if (!this.data) {
      this.formattedLocation = '-';
      return;
    }

    const city = this.data.city ? this.data.city : '';
    const subdivisionLikeCity = this.data.city === this.data.subdivision;
    let subdivision = this.data.subdivision;

    if (['US', 'CA'].includes(this.data.iso) === false || (this.type === 'node' && subdivisionLikeCity)) {
      this.data.subdivision = undefined;
    } else if (['list-isp', 'list-country'].includes(this.type) === true) {
      subdivision = convertRegion(this.data.subdivision, 'abbreviated');
    }

    if (this.type === 'list-country') {
      if (!this.data.city) {
        this.formattedLocation = '-';
      }
      else if (this.data.city) {
        this.formattedLocation += ' ' + city;
        if (this.data.subdivision) {
          this.formattedLocation += ', ' + subdivision;
        }
      }
    }

    if (this.type === 'list-isp') {
      if (!this.data.country && !this.data.city) {
        this.formattedLocation = '-';
      } else {
        if (this.data.country) {
          this.formattedLocation = getFlagEmoji(this.data.iso);
        } else {
          this.formattedLocation = '';
        }
        if (this.data.city) {
          this.formattedLocation += ' ' + city;
          if (this.data.subdivision) {
            this.formattedLocation += ', ' + subdivision;
          }
        } else {
          this.formattedLocation += ' ' + this.data.country;
        }
      }
    }
    
    if (this.type === 'node') {
      const city = this.data.city ? this.data.city : '';

      // Handle city-states like Singapore or Hong Kong
      if (city && city === this.data?.country) {
        this.formattedLocation = `${this.data.country} ${getFlagEmoji(this.data.iso)}`;
        return;
      }

      // City
      this.formattedLocation = `${city}`;

      // ,Subdivision
      if (this.formattedLocation.length > 0 && !subdivisionLikeCity) {
        this.formattedLocation += ', ';
      }
      if (!subdivisionLikeCity) {
        this.formattedLocation += `${subdivision}`;
      }

      // <br>[flag] County
      if (this.data?.country.length ?? 0 > 0) {
        if ((this.formattedLocation?.length ?? 0 > 0) && !subdivisionLikeCity) {
          this.formattedLocation += '<br>';
        } else if (this.data.city) {
          this.formattedLocation += ', ';
        }
        this.formattedLocation += `${this.data.country} ${getFlagEmoji(this.data.iso)}`;
      }

      return;
    }
  }

  isEllipsisActive(e): boolean {
    return (e.offsetWidth < e.scrollWidth);
  }
}
