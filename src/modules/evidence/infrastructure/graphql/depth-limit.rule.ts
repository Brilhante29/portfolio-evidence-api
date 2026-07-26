import {
  GraphQLError,
  Kind,
  type ValidationRule,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

export function createDepthLimitRule(maxDepth: number): ValidationRule {
  return (context) => ({
    Document(document: DocumentNode) {
      const fragments = new Map<string, FragmentDefinitionNode>();
      for (const definition of document.definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
          fragments.set(definition.name.value, definition);
        }
      }

      for (const definition of document.definitions) {
        if (definition.kind !== Kind.OPERATION_DEFINITION) {
          continue;
        }
        const depth = selectionDepth(definition.selectionSet, fragments, 0, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `GraphQL operation depth ${String(depth)} exceeds maximum ${String(maxDepth)}.`,
              {
                nodes: [definition],
                extensions: { code: 'QUERY_DEPTH_LIMIT' },
              },
            ),
          );
        }
      }
    },
  });
}

function selectionDepth(
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  currentDepth: number,
  visitedFragments: ReadonlySet<string>,
): number {
  let maximum = currentDepth;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const fieldDepth = currentDepth + 1;
      maximum = Math.max(
        maximum,
        selection.selectionSet
          ? selectionDepth(selection.selectionSet, fragments, fieldDepth, visitedFragments)
          : fieldDepth,
      );
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      maximum = Math.max(
        maximum,
        selectionDepth(selection.selectionSet, fragments, currentDepth, visitedFragments),
      );
    } else {
      const fragmentName = selection.name.value;
      const fragment = fragments.get(fragmentName);
      if (fragment && !visitedFragments.has(fragmentName)) {
        maximum = Math.max(
          maximum,
          selectionDepth(
            fragment.selectionSet,
            fragments,
            currentDepth,
            new Set([...visitedFragments, fragmentName]),
          ),
        );
      }
    }
  }
  return maximum;
}
