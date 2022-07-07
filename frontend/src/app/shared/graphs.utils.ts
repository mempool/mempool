export const formatterXAxis = (
  locale: string,
  windowPreference: string,
  value: string | number
) => {
  if (typeof value === 'string' && value.length === 0) {
    return null;
  }

  const date = new Date(value);
  switch (windowPreference) {
    case '2h':
      return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
    case '24h':
    case '3d':
    case '1w':
    case '1m':
    case '3m':
    case '6m':
    case '1y':
      return date.toLocaleTimeString(locale, { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    case '2y':
    case '3y':
    case 'all':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  }
};

export const formatterXAxisLabel = (
  locale: string,
  windowPreference: string,
) => {
  const date = new Date();
  switch (windowPreference) {
    case '2h':
    case '24h':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    case '3d':
    case '1w':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
    case '1m':
    case '3m':
    case '6m':
      return date.toLocaleDateString(locale, { year: 'numeric' });
    case '1y':
    case '2y':
    case '3y':
      return null;
  }
};

export const formatterXAxisTimeCategory = (
  locale: string,
  windowPreference: string,
  value: number
) => {
  const date = new Date(value);
  switch (windowPreference) {
    case '2h':
      return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
    case '24h':
      return date.toLocaleTimeString(locale, { weekday: 'short', hour: 'numeric' });
    case '3d':
    case '1w':
      return date.toLocaleTimeString(locale, { month: 'short', day: 'numeric', hour: 'numeric' });
    case '1m':
    case '3m':
      return date.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
    case '6m':
    case '1y':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    case '2y':
    case '3y':
    case 'all':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  }
};

export const download = (href, name) => {
  const a = document.createElement('a');
  a.download = name;
  a.href = href;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export function detectWebGL() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  return (gl && gl instanceof WebGLRenderingContext);
}
