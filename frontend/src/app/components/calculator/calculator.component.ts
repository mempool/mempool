import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { combineLatest, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],
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
      const rate = (value / price).toFixed(8);
      const satsRate = Math.round(value / price * 100_000_000);
      this.form.get('bitcoin').setValue(rate, { emitEvent: false });
      this.form.get('satoshis').setValue(satsRate, { emitEvent: false } );
    });

    combineLatest([
      this.price$,
      this.form.get('bitcoin').valueChanges
    ]).subscribe(([price, value]) => {
      const rate = parseFloat((value * price).toFixed(8));
      this.form.get('fiat').setValue(rate, { emitEvent: false } );
      this.form.get('satoshis').setValue(Math.round(value * 100_000_000), { emitEvent: false } );
    });

    combineLatest([
      this.price$,
      this.form.get('satoshis').valueChanges
    ]).subscribe(([price, value]) => {
      const rate = parseFloat((value / 100_000_000 * price).toFixed(8));
      const bitcoinRate = (value / 100_000_000).toFixed(8);
      this.form.get('fiat').setValue(rate, { emitEvent: false } );
      this.form.get('bitcoin').setValue(bitcoinRate, { emitEvent: false });
    });

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
    const sanitizedValue = this.removeExtraDots(value);
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
}
