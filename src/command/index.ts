import { namespace } from '../namespace/namespaces.enum';
import { Command } from './command.enum';
import { CHAT_QUESTIONS, CREATE_COMPONENT, WRITE_TEST } from '../questions';
import { chat } from '../actions';
import { Commands } from './types';
import { tests } from '../actions/tests';
import { createComponent } from '../actions/create-component';

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
  },
  [namespace.COMPONENT]: {
    [Command.MAKE_COMPONENT]: {
      id: Command.MAKE_COMPONENT,
      questions: CREATE_COMPONENT,
      creator: createComponent
    },
  }
};
