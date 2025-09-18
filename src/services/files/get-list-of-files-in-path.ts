import { glob } from 'glob';

export const getListOfFilesInPath =
  () =>
  async (pattern: string): Promise<{ fileContents: string }> => {
    const filePaths = glob.sync(pattern) as string[];

    let list = '';
    filePaths.forEach((filePath) => {
      list += filePath + '\n';
    });
    return { fileContents: list };
  };
