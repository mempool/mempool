export const addMinutes = (dt: Date, minutes: number) => {
  return new Date(dt.getTime() + minutes * 60000);
};

export const filterLabelDates = (labels: any, template: string, windowPreference: string) => {
  let labelDates = [];

  if (labels.length > 0) {
    const firstDate = new Date(labels[0]);
    const lastDate = new Date(labels[labels.length - 1]);
    let currentDate = firstDate;

    currentDate.setUTCMilliseconds(0);
    currentDate.setUTCSeconds(0);
    currentDate.setUTCMinutes(0);

    if (template !== 'widget') {

      if(['1w', '1m', '2m', '3m', '6m', '1y', '2y', '3y'].includes(windowPreference)){
        currentDate.setUTCMinutes(0);
      }

      if(['6m', '1y', '2y', '3y'].includes(windowPreference)){
        currentDate.setUTCHours(0);
      }
    }

    let timeIntervals = {
      '2h' : 10,           // 10 mins
      '24h': 120,          //  2 hours
      '1w' : 60 * 24,      //  1 day
      '1m' : 60 * 24 * 7,  //  7 days
      '3m' : 60 * 24 * 7,  //  7 days
      '6m' : 60 * 24 * 15, // 15 days
      '1y' : 60 * 24 * 30, // 30 days
      '2y' : 60 * 24 * 60, // 30 days
      '3y' : 60 * 24 * 60, // 30 days
    };

    if (window.innerWidth < 600 || template === 'widget') {
      timeIntervals = {
        '2h' : 30,           // 30 mins
        '24h': 60 * 6,       //  6 hours
        '1w' : 60 * 48,      //  2 day
        '1m' : 60 * 24 * 7,  //  7 days
        '3m' : 60 * 24 * 7,  // 15 days
        '6m' : 60 * 24 * 30, // 30 days
        '1y' : 60 * 24 * 30, // 30 days
        '2y' : 60 * 24 * 60, // 30 days
        '3y' : 60 * 24 * 60, // 30 days
      };
    }

    let windowPreferenceLocal = '2h';

    if(windowPreference in timeIntervals && template !== 'widget' && template !== 'tv') {
      windowPreferenceLocal = windowPreference;
    }

    while (currentDate.getTime() < lastDate.getTime()) {
      currentDate = addMinutes(currentDate, timeIntervals[windowPreferenceLocal]);
      labelDates.push(currentDate.toISOString());
    }
  }

  return labelDates;
}


export const labelsData = (labels: any, template: string, windowPreference: string) =>  (labels.map((label: string) => {
  const date = new Date(label);

  date.setUTCMilliseconds(0);
  date.setUTCSeconds(0);

  if (template !== 'widget') {

    if(['1w', '1m', '2m', '3m', '6m', '1y', '2y', '3y'].includes(windowPreference)){
      date.setUTCMinutes(0);
    }

    if(['6m', '1y', '2y', '3y'].includes(windowPreference)){
      date.setUTCHours(0);
    }
  }

  return date.toISOString();
}));


export const formatterXAxis = (
    template: string,
    locale: string,
    windowPreference: string,
    value: string
  ) => {

  if(value.length === 0){
    return null;
  }

  const date = new Date(value);
  if (template === 'widget') {
    return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
  }

  switch (windowPreference) {
    case '2h':
      return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
    case '24h':
      return date.toLocaleTimeString(locale, { hour: 'numeric' });
    case '1w':
    case '1m':
      return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' });
    case '3m':
    case '6m':
      return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    case '1y':
    case '2y':
    case '3y':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short' });
  }
}

export const dataZoom = (
    template: string,
    locale: string,
    showZoom: Boolean,
    windowPreference: string
  ) => ([{
  type: 'inside',
  realtime: true,
  zoomOnMouseWheel: (template === 'advanced') ? true : false,
  maxSpan: 100,
  minSpan: 10,
}, {
  show: (template === 'advanced' && showZoom) ? true : false,
  type: 'slider',
  brushSelect: false,
  realtime: true,
  bottom: 0,
  labelFormatter: (value, valueStr) => {
    const date = new Date (valueStr);
    switch (windowPreference) {
      case '1w':
      case '1m':
        return date.toLocaleDateString(locale, { month: 'short', weekday: 'short', day: 'numeric' });
      case '3m':
      case '6m':
      case '1y':
      case '2y':
      case '3y':
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'short' });
      default: // 2m, 24h
        return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
    }
  },
  selectedDataBackground: {
    lineStyle: {
      color: '#fff',
      opacity: 0.45,
    },
    areaStyle: {
      opacity: 0,
    }
  }
}]);
