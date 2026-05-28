import {
  Response,
  ResponseOutputItem,
  Tool,
} from 'openai/resources/responses/responses';

export type AiResponse = Pick<Response, 'id'> &
  Partial<Omit<Response, 'id' | 'output'>> & {
    __streamed?: true;
    output?: ResponseOutputItem[] | null;
    provider?: 'openai' | 'anthropic';
  };

export type AiService = {
  giveInfo: (text: string, responseId?: string) => Promise<AiResponse>;
  writeTest: (
    filePath: string,
    context: string,
    writePath: string,
    exampleTests: string,
    responseId?: string,
  ) => Promise<string>;
  startAgent: (prompt: string, id?: string) => Promise<AiResponse>;
  processResponse: (res: AiResponse) => Promise<AiResponse>;
};

export type AiServiceOptions = {
  tools?: Tool[];
  model?: string;
};
