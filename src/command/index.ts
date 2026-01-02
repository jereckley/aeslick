import { namespace } from '../namespace/namespaces.enum';
import { Command } from './command.enum';
import {
  CHAT_QUESTIONS,
  CREATE_COMPONENT,
  CREATE_PROJECT_CONFIG,
  WRITE_TEST,
} from '../questions';
import { chat } from '../actions';
import { Commands } from './types';
import { tests } from '../actions/tests';
import { createComponent } from '../actions/create-component';
import { createProjectConfig } from '../actions/create-project-config';

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
  },
  [namespace.COMPONENT]: {
    [Command.MAKE_COMPONENT]: {
      id: Command.MAKE_COMPONENT,
      questions: CREATE_COMPONENT,
      creator: createComponent
    },
  }
};
