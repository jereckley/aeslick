import { authentication } from './authentication';
import { configurations } from './configurations';
import { init } from './init';
import { interaction } from './interaction';
import { style } from './style';
import { graphql } from './graphql';

export const contextInput = [init, interaction, configurations, style, authentication, graphql];
