import { AxiosInstance } from 'axios';
import {
  Adjustment,
  DifficultyInstance,
} from '../../interfaces/bitcoin/difficulty';

export const useDifficulty = (api: AxiosInstance): DifficultyInstance => {
  const getDifficultyAdjustment = async () => {
    const { data } = await api.get<Adjustment>(`/difficulty-adjustment`);
    return data;
  };

  return {
    getDifficultyAdjustment,
  };
};
