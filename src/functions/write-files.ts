import { WriteFilesInput } from './types';

export const writeFile = async (input: string, root: string) => {
  const data = JSON.parse(input) as WriteFilesInput;
  await fse.writeFile(path.join(root, data.pathWithFileName), data.content);
};
