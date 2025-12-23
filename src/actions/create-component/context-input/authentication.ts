export const authentication = `
Authentication Guidelines:
1. Because the project is broken apart into multiple front ends and different apis to serve them some athentication points will live in the project configs.
2. A user can be part of an overaching organization or a location of an organization.
3. A user can have multiple roles and they are defined on a per organization or location basis.
4. See 'src/services/roles/roles.service.ts' in the 'Admin App' repo for info on the path in firestore the roles are defined. The map has a key of the organizationId or locationId and the value is a boolean. Each role path must be referenced.
5. If you need to create a new role the 'Admin App' repo must also be updated to manage the new role, the 'Firestore Rules' repo must be updated to reference the new role and protect the relevant resources with new rules.
6. Saving of information should always be secured unless its purely analytical and does not contain any PII data.
7. The 'GraphQL API' doesn't have any auth and is only there to serve data for the 'Component Library' repo and thus the 'Public Facing' repo. 
`
