const full = window.location.host;
const parts = full.split('.');
const sub = parts[0];

export const environment = {
  production: true,
  network: sub,
  nativeAssetId: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
};
