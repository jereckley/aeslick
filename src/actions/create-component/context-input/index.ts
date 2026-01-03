import { ContextConfig } from '../../../services/config/types';
import { authentication } from './authentication';
import { configurations } from './configurations';
import { graphql } from './graphql';
import { init } from './init';
import { interaction } from './interaction';
import { style } from './style';

export const defaultContextConfig: ContextConfig = {
  init,
  interaction,
  configurations,
  style,
  authentication,
  graphql,
};

export const buildContextInput = (contextConfig?: ContextConfig): string => {
  return contextConfig
    ? JSON.stringify(contextConfig)
    : JSON.stringify(defaultContextConfig);
};
