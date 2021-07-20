export const dates = (counter: number) => {
    return {
        i18nYear: $localize`:@@date-base.year:${counter}:DATE: year`,
        i18nYears: $localize`:@@date-base.years:${counter}:DATE: years`,
        i18nMonth: $localize`:@@date-base.month:${counter}:DATE: month`,
        i18nMonths: $localize`:@@date-base.months:${counter}:DATE: months`,
        i18nWeek: $localize`:@@date-base.week:${counter}:DATE: week`,
        i18nWeeks: $localize`:@@date-base.weeks:${counter}:DATE: weeks`,
        i18nDay: $localize`:@@date-base.day:${counter}:DATE: day`,
        i18nDays: $localize`:@@date-base.days:${counter}:DATE: days`,
        i18nHour: $localize`:@@date-base.hour:${counter}:DATE: hour`,
        i18nHours: $localize`:@@date-base.hours:${counter}:DATE: hours`,
        i18nMinute: $localize`:@@date-base.minute:${counter}:DATE: minute`,
        i18nMinutes: $localize`:@@date-base.minutes:${counter}:DATE: minutes`,
        i18nSecond: $localize`:@@date-base.second:${counter}:DATE: second`,
        i18nSeconds: $localize`:@@date-base.seconds:${counter}:DATE: seconds`,
    }
}