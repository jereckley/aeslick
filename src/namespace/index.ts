import { namespace } from './namespaces.enum';
import { Namespaces } from './types';

export const namespaces: Namespaces = {
  [namespace.CHAT]: {
    name: 'Chat',
    id: namespace.CHAT,
    description: 'Conversation in the console.',
  },
};
