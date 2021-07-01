/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../model/graphql/types.generated'

import {
  RoleSelection_UnmanagedRole_Fragment,
  RoleSelection_ManagedRole_Fragment,
  RoleSelectionFragmentDoc,
} from './RoleSelection.generated'

export type containers_Admin_RolesRolesQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_RolesRolesQuery = { readonly __typename: 'Query' } & {
  readonly roles: ReadonlyArray<
    | ({ readonly __typename: 'UnmanagedRole' } & RoleSelection_UnmanagedRole_Fragment)
    | ({ readonly __typename: 'ManagedRole' } & RoleSelection_ManagedRole_Fragment)
  >
}

export const containers_Admin_RolesRolesDocument = ({
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_RolesRoles' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'roles' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'RoleSelection' },
                },
              ],
            },
          },
        ],
      },
    },
    ...RoleSelectionFragmentDoc.definitions,
  ],
} as unknown) as DocumentNode<
  containers_Admin_RolesRolesQuery,
  containers_Admin_RolesRolesQueryVariables
>

export { containers_Admin_RolesRolesDocument as default }