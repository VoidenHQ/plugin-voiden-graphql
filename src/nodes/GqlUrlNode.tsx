/**
 * GQL URL Node
 *
 * Inline-content node for the GraphQL endpoint URL (supports env var highlights).
 */

import React from "react";
import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { NodeViewContent, ReactNodeViewRenderer } from "@tiptap/react";
import { Play } from "lucide-react";

export const createGqlUrlNode = (NodeViewWrapper: any, useSendRestRequest?: any) => {
  const GqlUrlComponent = (props: any) => {
    const sendRequest = useSendRestRequest ? useSendRestRequest(props.editor) : null;
    const isEditable = props.editor.isEditable;

    return (
      <NodeViewWrapper>
        <div className="bg-panel border-t border-b border-border px-3 py-1.5 flex items-center gap-2">
          <span className="text-xs text-comment font-medium uppercase tracking-wide shrink-0">POST</span>
          <div
            className={`flex-1 px-2 py-1 bg-editor border border-border rounded text-sm text-text focus-within:outline-none transition-colors font-mono min-h-[28px] ${isEditable ? 'focus-within:border-accent' : 'cursor-default'}`}
          >
            <NodeViewContent />
          </div>
          {sendRequest && (
            <button
              className="flex items-center justify-center w-7 h-7 rounded-md border hover:bg-hover text-status-success transition-colors shrink-0"
              onClick={(e) => {
                sendRequest.refetchFromElement(e.currentTarget as HTMLElement);
              }}
              style={{ borderColor: 'var(--ui-line)', cursor: 'pointer', userSelect: 'none' }}
              title="Send request"
            >
              <Play size={12} />
            </button>
          )}
        </div>
      </NodeViewWrapper>
    );
  };

  return Node.create({
    name: "gqlurl",
    group: "",
    content: "inline*",
    atom: false,
    isolating: false,

    parseHTML() {
      return [{ tag: "gqlurl" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["gqlurl", mergeAttributes(HTMLAttributes), 0];
    },

    addNodeView() {
      return ReactNodeViewRenderer(GqlUrlComponent);
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("gqlurlSelectAll"),
          props: {
            // This node is inline content in the main document, not an isolated
            // field, so a plain Node-level "Mod-a" keyboard shortcut isn't reliable
            // here — TipTap's core Keymap extension also binds Mod-a to a
            // whole-document selectAll, and depending on extension/priority
            // ordering that one can win instead. The core app's own cmdAll
            // extension (apps/ui/.../extensions/cmdAll.tsx) solves the identical
            // problem for the REST url/mcpurl fields the same way: intercept at
            // the raw DOM keydown level — every plugin's handleDOMEvents.keydown
            // gets checked in order regardless of keymap priority, so this always
            // gets a chance to run and, once it matches, fully short-circuits
            // further handling via preventDefault + stopPropagation.
            handleDOMEvents: {
              keydown: (view, event) => {
                const isSelectAll = (event.metaKey || event.ctrlKey) && (event.key === "a" || event.key === "A");
                if (!isSelectAll) return false;

                const { state } = view;
                const { $from } = state.selection;
                const node = $from.node();
                if (!node || node.type.name !== "gqlurl") return false;

                event.preventDefault();
                event.stopPropagation();
                const from = $from.start();
                const to = $from.end();
                view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
                return true;
              },
            },
          },
        }),
      ];
    },
  });
};

export const GqlUrlNode = createGqlUrlNode(
  ({ children }: any) => <div>{children}</div>
);
