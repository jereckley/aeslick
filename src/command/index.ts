import { namespace } from '../namespace/namespaces.enum';
import { Command } from './command.enum';
import { CHAT_QUESTIONS } from '../questions';
import { chat } from '../actions';
import { Commands } from './types';

export const commands: Commands = {
  [namespace.CHAT]: {
    [Command.SIMPLE_REQUEST]: {
      id: Command.SIMPLE_REQUEST,
      questions: CHAT_QUESTIONS,
      creator: chat,
    },
  },
};
