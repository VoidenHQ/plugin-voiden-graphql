/**
 * GraphQL Variables Node
 *
 * JSON editor for GraphQL variables — mirrors the JSON body block patterns
 */

import React from "react";
import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Sparkles, RefreshCw } from "lucide-react";
import { extractOperations } from "../utils/query-parser";
import { generateVariablesFromQuery, areVariablesJSONEquivalent } from "../utils/graphql-parser";

const prettifyJSON = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
};

// Finds the gqlbody paired with this gqlvariables node — same-section nearest
// gqlquery, mirroring GqlBodyNode's forward search but starting from the
// variables node and looking both directions.
const findPairedQueryBody = (editor: any, getPos: () => number | undefined): string | null => {
  const pos = typeof getPos === 'function' ? getPos() : null;
  if (pos == null) return null;
  const doc = editor.state.doc;

  const topLevel: Array<{ type: string; node: any; pos: number }> = [];
  doc.forEach((node: any, p: number) => topLevel.push({ type: node.type.name, node, pos: p }));

  let ourIdx = -1;
  for (let i = 0; i < topLevel.length; i++) {
    const { pos: p, node } = topLevel[i];
    if (p === pos) { ourIdx = i; break; }
    if (pos > p && pos < p + node.nodeSize) { ourIdx = i; break; }
  }
  if (ourIdx === -1) return null;

  const findGqlBody = (queryNode: any): string | null => {
    let body: string | null = null;
    queryNode.forEach((child: any) => {
      if (body == null && child.type.name === 'gqlbody') body = child.attrs.body || '';
    });
    return body;
  };

  for (let i = ourIdx + 1; i < topLevel.length; i++) {
    const t = topLevel[i].type;
    if (t === 'gqlvariables' || t === 'request-separator') break;
    if (t === 'gqlquery') return findGqlBody(topLevel[i].node);
  }
  for (let i = ourIdx - 1; i >= 0; i--) {
    const t = topLevel[i].type;
    if (t === 'gqlvariables' || t === 'request-separator') break;
    if (t === 'gqlquery') return findGqlBody(topLevel[i].node);
  }
  return null;
};

export const createGraphQLVariablesNode = (NodeViewWrapper: any, CodeEditor: any, RequestBlockHeader: any) => {
  const Actions = ({ setText, onResync }: { setText: () => void; onResync: () => void }) => {
    return (
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono text-comment hover:text-text transition-colors opacity-60 hover:opacity-100"
          onClick={onResync}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title="Regenerate variables from the paired query"
        >
          <RefreshCw size={11} />
          <span>RESYNC</span>
        </button>
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono text-comment hover:text-text transition-colors opacity-60 hover:opacity-100"
          onClick={setText}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <Sparkles size={11} />
          <span>PRETTIFY</span>
        </button>
      </div>
    );
  };

  const GraphQLVariablesComponent = (props: any) => {
    const [shouldAutofocus, setShouldAutofocus] = React.useState(false);

    // Check if this is an imported/linked block
    const isImported = !!props.node.attrs.importedFrom;
    const isEditable = props.editor.isEditable;

    // Ensure the node always has a valid JSON body with proper formatting.
    // Skip the very first run — that fires on initial mount from loaded file
    // content, and a saved, valid "{}" (no variables) is not malformed data
    // that needs fixing; rewriting it on load mutates a freshly opened,
    // unedited document and marks it dirty before the user has touched
    // anything. Only normalize in response to a subsequent real change.
    const isFirstNormalizeRef = React.useRef(true);
    React.useEffect(() => {
      if (isFirstNormalizeRef.current) {
        isFirstNormalizeRef.current = false;
        return;
      }
      if (!isEditable) return;
      let body = props.node.attrs.body;

      // Handle case where body was parsed as an object instead of a string
      if (typeof body === 'object' && body !== null) {
        try {
          body = JSON.stringify(body, null, 2);
          props.updateAttributes({ body });
          return;
        } catch {
          body = '{\n  \n}';
        }
      }

      if (!body || (typeof body === 'string' && (body.trim() === '' || body === '{}'))) {
        props.updateAttributes({ body: '{\n  \n}' });
      }
    }, [props.node.attrs.body]);

    // Handle autofocus on creation (only for non-imported blocks)
    React.useEffect(() => {
      if (!isImported && props.editor.storage.gqlvariables?.shouldFocusNext) {
        setShouldAutofocus(true);
        const timer = setTimeout(() => {
          if (props.editor.storage.gqlvariables) {
            props.editor.storage.gqlvariables.shouldFocusNext = false;
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [props.editor.storage.gqlvariables?.shouldFocusNext, isImported]);

    const handlePrettify = () => {
      try {
        const currentValue = props.node.attrs.body || '{}';
        const prettified = prettifyJSON(currentValue);
        props.updateAttributes({ body: prettified });
      } catch {}
    };

    // Manual resync — the only other way (besides typing in the query
    // itself) that variables get regenerated. No automatic/mount-driven
    // trigger, so opening a file never rewrites this block on its own.
    const handleResync = () => {
      try {
        const queryBody = findPairedQueryBody(props.editor, props.getPos);
        if (!queryBody) return;
        const operations = extractOperations(queryBody);
        const firstOperation = operations[0]?.name;
        if (!firstOperation) return;
        const currentVariables = props.node.attrs.body || '{}';
        const newVariables = generateVariablesFromQuery(queryBody, currentVariables, firstOperation);
        if (!areVariablesJSONEquivalent(newVariables, currentVariables)) {
          props.updateAttributes({ body: newVariables });
        }
      } catch {}
    };

    return (
      <NodeViewWrapper>
        <div className="my-2">
          <RequestBlockHeader
            title="GRAPHQL-VARIABLES"
            withBorder={false}
            editor={props.editor}
            actions={!isImported && isEditable ? <Actions setText={handlePrettify} onResync={handleResync} /> : undefined}
            blockType="gqlvariables"
          />
          <div style={{ height: 'auto' }}>
            <CodeEditor
              tiptapProps={props}
              lang="jsonc"
              showReplace={false}
              autofocus={shouldAutofocus && isEditable && !isImported}
              readOnly={isImported || !isEditable}
            />
          </div>
        </div>
      </NodeViewWrapper>
    );
  };

  return Node.create({
    name: "gqlvariables",
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
      return {
        body: {
          default: '{\n  \n}',
          parseHTML: (element: any) => {
            const content = element.textContent || "";
            try {
              return content ? JSON.stringify(JSON.parse(content), null, 2) : '{\n  \n}';
            } catch {
              return content || '{\n  \n}';
            }
          },
        },
        importedFrom: {
          default: undefined,
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: "gqlvariables",
          getAttrs: (element: any) => {
            const body = element.textContent;
            return { body };
          },
        },
      ];
    },

    renderHTML({ HTMLAttributes }: any) {
      return [
        "div",
        mergeAttributes(HTMLAttributes, { class: "gql-variables-block" }),
      ];
    },

    addStorage() {
      return {
        shouldFocusNext: true,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(GraphQLVariablesComponent);
    },

    addKeyboardShortcuts() {
      return {
        Backspace: ({ editor }: any) => {
          const { selection } = editor.state;
          const node = selection.$from.node();
          if (node?.type.name === 'gqlvariables') {
            return true;
          }
          return false;
        },
        Delete: ({ editor }: any) => {
          const { selection } = editor.state;
          const node = selection.$from.node();
          if (node?.type.name === 'gqlvariables') {
            return true;
          }
          return false;
        },
      };
    },
  });
};

export const GraphQLVariablesNode = createGraphQLVariablesNode(
  ({ children }: any) => <div>{children}</div>,
  () => <div>CodeEditor not available</div>,
  () => <div>Header not available</div>
);
