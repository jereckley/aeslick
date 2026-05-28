import { Tool } from 'openai/resources/responses/responses';
import { Command } from '../../command/command.enum';
import { namespace } from '../../namespace/namespaces.enum';
import {
  ConfigurableToolName,
  getConfigurableToolsByName,
  sanitizeConfigurableToolNames,
} from '../../tools';
import { BaseConfig, CommandConfigKey } from './types';

export const CHAT_COMMAND_CONFIG_KEY =
  `${namespace.CHAT}.${Command.SIMPLE_REQUEST}` as CommandConfigKey;
export const COMPONENT_COMMAND_CONFIG_KEY =
  `${namespace.COMPONENT}.${Command.MAKE_COMPONENT}` as CommandConfigKey;

export const COMMAND_TOOL_CONFIG_CHOICES: Array<{
  name: string;
  value: CommandConfigKey;
}> = [
  {
    name: 'Chat: simple',
    value: CHAT_COMMAND_CONFIG_KEY,
  },
  {
    name: 'Component: new',
    value: COMPONENT_COMMAND_CONFIG_KEY,
  },
];

export const DEFAULT_COMMAND_TOOL_NAMES: Partial<
  Record<CommandConfigKey, ConfigurableToolName[]>
> = {
  [CHAT_COMMAND_CONFIG_KEY]: [
    'write-file',
    'inspect-webpage',
    'chrome-headless-browser',
  ],
  [COMPONENT_COMMAND_CONFIG_KEY]: [
    'get-config-by-name',
    'prompt-for-input',
    'write-file',
    'get-list-of-files-in-path',
    'get-file-by-path',
    'get-image-by-path',
    'get-image-inputs-by-file-names',
    'image_generation',
    'run-npm-command',
    'publish-library-and-wait',
    'deploy-repo',
    'inspect-webpage',
    'chrome-headless-browser',
  ],
};

export const getDefaultCommandToolsConfig = (): BaseConfig['commandTools'] => {
  return Object.entries(DEFAULT_COMMAND_TOOL_NAMES).reduce<
    NonNullable<BaseConfig['commandTools']>
  >((acc, [commandKey, toolNames]) => {
    acc[commandKey as CommandConfigKey] = [...(toolNames ?? [])];
    return acc;
  }, {});
};

export const getConfiguredToolNamesForCommand = (
  baseConfig: BaseConfig | undefined,
  commandKey: CommandConfigKey,
) => {
  const configured = baseConfig?.commandTools?.[commandKey];
  if (Array.isArray(configured)) {
    return sanitizeConfigurableToolNames(configured);
  }
  return [...(DEFAULT_COMMAND_TOOL_NAMES[commandKey] ?? [])];
};

export const getToolsForCommand = (
  baseConfig: BaseConfig | undefined,
  commandKey: CommandConfigKey,
): Tool[] => {
  return getConfigurableToolsByName(
    getConfiguredToolNamesForCommand(baseConfig, commandKey),
  );
};

export const getModelForCommand = (
  baseConfig: BaseConfig | undefined,
  commandKey: CommandConfigKey,
) => {
  if (commandKey === CHAT_COMMAND_CONFIG_KEY) {
    return baseConfig?.chatModel?.trim() || baseConfig?.model || '';
  }
  return baseConfig?.model || '';
};

export const getCommandConfigLabel = (commandKey: CommandConfigKey) => {
  const match = COMMAND_TOOL_CONFIG_CHOICES.find(
    (choice) => choice.value === commandKey,
  );
  return match?.name ?? commandKey;
};
