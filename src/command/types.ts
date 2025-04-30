import { Questions } from 'inquirer';
import { Command } from './command.enum';
import { namespace } from '../namespace/namespaces.enum';

export type CommandsCollection = Command;

export type CommandDetails = {
  id: string;
  questions?: Questions<any> | ((config: unknown) => Questions<any>);
  creator: (arg?: any, extraArgs?: any) => Promise<void>;
};

export type CommandInCommands = {
  [key in CommandsCollection]: CommandDetails;
}

export type Commands = {
  [key in namespace]: CommandInCommands
};
