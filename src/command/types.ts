import { Questions } from 'inquirer';
import { Command } from './command.enum';
import { namespace } from '../namespace/namespaces.enum';

export type CommandsCollection = Command;

export type CommandDetails = {
  id: string;
  questions?: Questions<any>;
  creator: (arg?: any) => Promise<void>;
};

export type CommandInCommands = Partial<
  Record<CommandsCollection, CommandDetails>
>;

export type Commands = {
  [key in namespace]: CommandInCommands;
};
