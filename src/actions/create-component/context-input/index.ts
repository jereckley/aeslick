import { ContextConfig, ContextKeys } from '../../../services/config/types';
import { authentication } from './authentication';
import { configurations } from './configurations';
import { graphql } from './graphql';
import { init } from './init';
import { interaction } from './interaction';
import { style } from './style';

const contextOrder: ContextKeys[] = [
  'init',
  'interaction',
  'configurations',
  'style',
  'authentication',
  'graphql',
];

export const defaultContextConfig: ContextConfig = {
  init,
  interaction,
  configurations,
  style,
  authentication,
  graphql,
};

export const buildContextInput = (contextConfig?: ContextConfig): string[] => {
  const mergedContext = {
    ...defaultContextConfig,
    ...(contextConfig ?? {}),
  };

  return contextOrder
    .map((key) => mergedContext[key])
    .filter((section): section is string => !!section);
};
