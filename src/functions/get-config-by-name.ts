import { configService } from '../services/config';
import { GetConfigByNameInput } from './types';

export const getConfigByName = async (input: string) => {
  const data = JSON.parse(input) as GetConfigByNameInput;
  const config = (await configService()).getProjectConfig(data.name);
  return config;
};
