import { ResponseOutputItem } from 'openai/resources/responses/responses';

type ResponseLike = {
  output?: ResponseOutputItem[] | null;
};

export const isRestartableResponse = (response?: ResponseLike) => {
  const items = response?.output ?? [];
  let hasAssistantMessage = false;

  for (const item of items) {
    if (item.type === 'message') {
      hasAssistantMessage = true;
      continue;
    }

    if (item.type === 'reasoning') {
      continue;
    }

    return false;
  }

  return hasAssistantMessage;
};
