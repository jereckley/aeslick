import { namespace } from '../namespace/namespaces.enum';
import { Command } from './command.enum';
import {
  CHAT_QUESTIONS,
  CONFIGURE_COMMAND_TOOLS,
  CREATE_BASE_CONFIG,
  CREATE_COMPONENT,
  CREATE_PROJECT_CONFIG,
  WRITE_TEST,
} from '../questions';
import { chat } from '../actions';
import { Commands } from './types';
import { tests } from '../actions/tests';
import { createComponent } from '../actions/create-component';
import { createProjectConfig } from '../actions/create-project-config';
import { createBaseConfig } from '../actions/create-base-config';
import { configureCommandTools } from '../actions/configure-command-tools';

export const commands: Commands = {
  [namespace.CHAT]: {
    [Command.SIMPLE_REQUEST]: {
      id: Command.SIMPLE_REQUEST,
      questions: CHAT_QUESTIONS,
      creator: chat,
    },
  },
  [namespace.CODE]: {
    [Command.WRITE_TESTS]: {
      id: Command.WRITE_TESTS,
      questions: WRITE_TEST,
      creator: tests,
    },
    [Command.CREATE_PROJECT_CONFIG]: {
      id: Command.CREATE_PROJECT_CONFIG,
      questions: CREATE_PROJECT_CONFIG,
      creator: createProjectConfig,
    },
    [Command.CREATE_BASE_CONFIG]: {
      id: Command.CREATE_BASE_CONFIG,
      questions: CREATE_BASE_CONFIG,
      creator: createBaseConfig,
    },
    [Command.CONFIGURE_COMMAND_TOOLS]: {
      id: Command.CONFIGURE_COMMAND_TOOLS,
      questions: CONFIGURE_COMMAND_TOOLS,
      creator: configureCommandTools,
    },
  },
  [namespace.COMPONENT]: {
    [Command.MAKE_COMPONENT]: {
      id: Command.MAKE_COMPONENT,
      questions: CREATE_COMPONENT,
      creator: createComponent
    },
  }
};
