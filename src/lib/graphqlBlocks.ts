export interface GraphQLContentNode {
  type?: string;
  attrs?: { body?: string; [key: string]: unknown };
  content?: GraphQLContentNode[];
}

export interface GraphQLBlockPair {
  queryNode: GraphQLContentNode | undefined;
  variablesNode: GraphQLContentNode | undefined;
}

/**
 * Pair gqlvariables with the last gqlquery in the active section.
 * In a multi-request file (sections separated by request-separator) each
 * gqlvariables block belongs to the gqlquery in the same section, not the
 * first gqlquery in the document.
 */
export function resolveGraphQLBlocks(
  content: GraphQLContentNode[] | undefined,
): GraphQLBlockPair {
  if (!content?.length) {
    return { queryNode: undefined, variablesNode: undefined };
  }

  const queries = content.filter((n) => n.type === 'gqlquery');
  if (queries.length === 0) {
    return { queryNode: undefined, variablesNode: undefined };
  }

  const queryNode = queries[queries.length - 1];
  const qIdx = content.indexOf(queryNode);
  let variablesNode: GraphQLContentNode | undefined;

  // Look for gqlvariables after the query — stop at next gqlquery or request-separator
  for (let i = qIdx + 1; i < content.length; i++) {
    const t = content[i].type;
    if (t === 'gqlquery' || t === 'request-separator') break;
    if (t === 'gqlvariables') { variablesNode = content[i]; break; }
  }

  // Fall back to gqlvariables before the query — stop at previous gqlquery or request-separator
  if (!variablesNode) {
    for (let i = qIdx - 1; i >= 0; i--) {
      const t = content[i].type;
      if (t === 'gqlquery' || t === 'request-separator') break;
      if (t === 'gqlvariables') { variablesNode = content[i]; break; }
    }
  }

  return { queryNode, variablesNode };
}

export function parseGraphQLVariablesBody(
  body: string | undefined,
): Record<string, unknown> {
  if (!body?.trim()) return {};
  try {
    const parsed = JSON.parse(body) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
