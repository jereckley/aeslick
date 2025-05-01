import { namespace } from '../namespace/namespaces.enum';
import { Command } from './command.enum';
import { CHAT_QUESTIONS, WRITE_TEST } from '../questions';
import { chat } from '../actions';
import { Commands } from './types';
import { tests } from '../actions/tests';

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
};
