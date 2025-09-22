import * as fs from 'fs';

export const writeBase64Image =
  () => async (path: string, base64String: string) => {
    await fs.writeFileSync(path, Buffer.from(base64String, 'base64'));
  };
