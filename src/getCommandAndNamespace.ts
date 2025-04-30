import { commands } from './command';
import { Command } from './command/command.enum';
import { NamespaceDetails } from './namespace/types';

export const getCommandAndNamespace = (
  namespaceDetails: NamespaceDetails | undefined,
  command?: string,
): [NamespaceDetails | undefined, Command | undefined] => {
  if (!namespaceDetails) {
    return [undefined, undefined];
  }

  const found = Object.keys(commands[namespaceDetails.id]).find(
    (key) => key === command,
  );


  if (!found) {
    return [namespaceDetails, undefined];
  }
  return [namespaceDetails, command as Command];
};
