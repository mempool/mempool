import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { combineLatest, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculatorComponent implements OnInit {
  satoshis = 10000;
  form: FormGroup;

  currency$ = this.stateService.fiatCurrency$;
  price$: Observable<number>;
  lastFiatPrice$: Observable<number>;

  constructor(
    private stateService: StateService,
    private formBuilder: FormBuilder,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      fiat: [0],
      bitcoin: [0],
      satoshis: [0],
    });

    this.lastFiatPrice$ = this.stateService.conversions$.asObservable()
      .pipe(
        map((conversions) => conversions.time)
      );

    let currency;
    this.price$ = this.currency$.pipe(
      switchMap((result) => {
        currency = result;
        return this.stateService.conversions$.asObservable();
      }),
      map((conversions) => {
        return conversions[currency];
      })
    );

    combineLatest([
      this.price$,
      this.form.get('fiat').valueChanges
    ]).subscribe(([price, value]) => {
      let rate = parseFloat((value / price).toFixed(8));
      if (rate > 21000000) {
        rate = 21000000;
      }
      const satsRate = Math.round(rate * 100_000_000);
      if (isNaN(value)) {
        return;
      }
      this.form.get('bitcoin').setValue(rate.toFixed(8), { emitEvent: false });
      this.form.get('satoshis').setValue(satsRate, { emitEvent: false } );
    });

    combineLatest([
      this.price$,
      this.form.get('bitcoin').valueChanges
    ]).subscribe(([price, value]) => {
      const rate = parseFloat((value * price).toFixed(8));
      if (isNaN(value)) {
        return;
      }
      this.form.get('fiat').setValue(this.formatFiat(rate), { emitEvent: false } );
      this.form.get('satoshis').setValue(Math.round(value * 100_000_000), { emitEvent: false } );
    });

    combineLatest([
      this.price$,
      this.form.get('satoshis').valueChanges
    ]).subscribe(([price, value]) => {
      let bitcoinValue = value / 100_000_000;
      if (bitcoinValue > 21000000) {
        bitcoinValue = 21000000;
        value = 21000000 * 100_000_000;
      }
      const rate = parseFloat((bitcoinValue * price).toFixed(8));
      const bitcoinRate = bitcoinValue.toFixed(8);
      if (isNaN(value)) {
        return;
      }
      this.form.get('fiat').setValue(this.formatFiat(rate), { emitEvent: false } );
      this.form.get('bitcoin').setValue(bitcoinRate, { emitEvent: false });
    });

    // Default form with 1 BTC
    this.form.get('bitcoin').setValue(1, { emitEvent: true });
  }

  transformInput(name: string): void {
    const formControl = this.form.get(name);
    if (!formControl.value) {
      return formControl.setValue('', {emitEvent: false});
    }
    let value = formControl.value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (value === '.') {
      value = '0';
    }
    let sanitizedValue = this.removeExtraDots(value);
    if (name === 'bitcoin' && this.countDecimals(sanitizedValue) > 8) {
      sanitizedValue = this.toFixedWithoutRounding(sanitizedValue, 8);
    }
    if (sanitizedValue === '') {
      sanitizedValue = '0';
    }
    if (name === 'satoshis') {
      sanitizedValue = parseFloat(sanitizedValue).toFixed(0);
    }
    if (name === 'bitcoin' && parseFloat(sanitizedValue) >= 21000000) {
      sanitizedValue = '21000000';
    }
    if (name === 'satoshis' && parseFloat(sanitizedValue) > 2100000000000000) {
      sanitizedValue = '2100000000000000';
    }
    formControl.setValue(sanitizedValue, {emitEvent: true});
  }

  removeExtraDots(str: string): string {
    const [beforeDot, afterDot] = str.split('.', 2);
    if (afterDot === undefined) {
      return str;
    }
    const afterDotReplaced = afterDot.replace(/\./g, '');
    return `${beforeDot}.${afterDotReplaced}`;
  }

  countDecimals(numberString: string): number {
    const decimalPos = numberString.indexOf('.');
    if (decimalPos === -1) {return 0;}
    return numberString.length - decimalPos - 1;
  }

  toFixedWithoutRounding(numStr: string, fixed: number): string {
    const re = new RegExp(`^-?\\d+(?:.\\d{0,${(fixed || -1)}})?`);
    const result = numStr.match(re);
    return result ? result[0] : numStr;
  }

  selectAll(event): void {
    event.target.select();
  }

  formatFiat(num: number): string | number {
    if (Math.abs(num) >= 1000) {
      // For values >= 1000: show 2 decimals, or 0 if whole number
      if (num % 1 === 0) {
        return Math.round(num);
      }
      return (Math.round(num * 100) / 100).toFixed(2);
    }
    return num;
  }
}
