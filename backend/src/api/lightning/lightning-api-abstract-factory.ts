import { ILightningApi } from './lightning-api.interface';

export interface AbstractLightningApi {
  $getNetworkGraph(): Promise<ILightningApi.NetworkGraph>;
}
