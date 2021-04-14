import { AxiosInstance } from 'axios';
import { Address, AddressesInstance } from '../../interfaces/bisq/addresses';

export const useAddresses = (api: AxiosInstance): AddressesInstance => {
  const getAddress = async (params: { address: string }) => {
    const { data } = await api.get<Address>(`/block/${params.address}`);
    return data;
  };

  return {
    getAddress,
  };
};
