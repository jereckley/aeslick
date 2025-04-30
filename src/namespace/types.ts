import { namespace } from './namespaces.enum';

export type NamespaceDetails = {
  name: string;
  id: namespace;
  description: string;
};
export type Namespaces = {
  [key in namespace]: NamespaceDetails;
};
