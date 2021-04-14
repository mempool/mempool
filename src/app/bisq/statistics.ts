import { AxiosInstance } from 'axios';
import { Stats, StatsInstance } from '../../interfaces/bisq/statistics';

export const useStatistics = (api: AxiosInstance): StatsInstance => {
  const getStats = async () => {
    const { data } = await api.get<Stats>(`/stats`);
    return data;
  };

  return {
    getStats,
  };
};
