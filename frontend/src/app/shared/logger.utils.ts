window['DEV_MODE'] = localStorage.getItem('dev_mode') === 'true';
export function log(...msgs: any[]): void {
  if (window['DEV_MODE']) {
    console.log(...msgs);
  }
}