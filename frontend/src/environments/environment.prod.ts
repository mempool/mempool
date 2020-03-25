const full = window.location.host;
const parts = full.split('.');
const sub = parts[0];

export const environment = {
  production: true,
  network: sub,
};
