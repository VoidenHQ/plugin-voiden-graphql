/**
 * Voiden GraphQL Plugin
 * 
 * Complete GraphQL client with query/mutation/subscription support
 */

import type { CorePluginContext } from '@voiden/sdk/ui';
type PluginContext = CorePluginContext;
import { parseGraphQLVariablesBody, resolveGraphQLBlocks } from './lib/graphqlBlocks';
import { parseGraphQLOperation } from './lib/utils';
import { readAuth, readTableHeaders } from './lib/requestHeaders';
import { GraphQLQueryHelp, GraphQLVariablesHelp } from './help/index';
import manifest from '../manifest.json';

export default function createGraphQLPlugin(context: PluginContext) {

  return {
    onload: async () => {
      // Get context components and hooks
      const { NodeViewWrapper, CodeEditor, RequestBlockHeader } = context.ui.components;
      const { useSendRestRequest } = context.ui.hooks;

      // Import node factories dynamically
      const {
        createGraphQLQueryNode,
        createGraphQLVariablesNode,
        createGraphQLSubscriptionEventsNode,
        createGqlUrlNode,
        createGqlBodyNode,
      } = await import('./nodes');

      // Create nodes with context components
      const GraphQLQueryNode = createGraphQLQueryNode(NodeViewWrapper, CodeEditor, RequestBlockHeader, useSendRestRequest);
      const GraphQLVariablesNode = createGraphQLVariablesNode(NodeViewWrapper, CodeEditor, RequestBlockHeader);
      const GraphQLSubscriptionEventsNode = createGraphQLSubscriptionEventsNode(NodeViewWrapper, context, CodeEditor);
      const GqlUrlNode = createGqlUrlNode(NodeViewWrapper, useSendRestRequest);
      const GqlBodyNode = createGqlBodyNode(NodeViewWrapper, CodeEditor);

      // Register nodes
      context.registerVoidenExtension(GraphQLQueryNode);
      context.registerVoidenExtension(GraphQLVariablesNode);
      context.registerVoidenExtension(GraphQLSubscriptionEventsNode);
      context.registerVoidenExtension(GqlUrlNode);
      context.registerVoidenExtension(GqlBodyNode);

      // Register linkable node types
      context.registerLinkableNodeTypes([
        'gqlquery',
        'gqlbody',
        'gqlurl',
        'gqlvariables',
        'gqlsubscriptionevents',
      ]);

      // docsUrl defaults every block to the voiden-blocks root for now — per-block deep link paths TBD.
      const DOCS_URL = "https://docs.voiden.md/docs/core-features-section/voiden-blocks/graphql-query";
      (context as any).registerBlockOutlineMeta({
        gqlquery: {
          label: "GraphQL Query",
          icon: "Zap",
          docsUrl: DOCS_URL,
          getPreview: (_attrs: Record<string, any>, textContent: string) => {
            if (!textContent) return undefined;
            const trimmed = textContent.trim();
            return trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed || undefined;
          },
        },
        gqlurl: { label: "URL", icon: "Globe", docsUrl: DOCS_URL },
        gqlbody: { label: "Query Body", icon: "Braces", docsUrl: DOCS_URL },
        gqlvariables: { label: "Variables", icon: "Variable", docsUrl: "https://docs.voiden.md/docs/core-features-section/voiden-blocks/graphql-variable" },
        gqlsubscriptionevents: { label: "Subscription Events", icon: "Radio", docsUrl: DOCS_URL },
      });

      // Inline block "?" help tooltip (RequestBlockHeader)
      (context as any).registerBlockHelp?.({
        gqlquery: GraphQLQueryHelp,
        gqlvariables: GraphQLVariablesHelp,
      });

      // Register request building handler
      context.onBuildRequest(async (request, editor) => {
        try {
          // Get the JSON from the editor (linked blocks are already expanded by the orchestrator)
          const editorJson = editor.getJSON();

          // Only handle documents with a gqlquery node
          const { queryNode: gqlNode, variablesNode: gqlVariablesNode } = resolveGraphQLBlocks(
            editorJson.content,
          );
          if (!gqlNode) return request; // Not a GraphQL doc, pass through

          // Use a fresh base request object — all protocol-specific fields are set below
          // @ts-ignore - Path resolved at runtime in app context
          request = (context as any).helpers.requestUtils.createNewRequestObject();

          // Support new format (gqlurl/gqlbody children) and old format (direct attrs)
          const gqlBodyChild = gqlNode.content?.find((n: any) => n.type === 'gqlbody');
          const gqlUrlChild = gqlNode.content?.find((n: any) => n.type === 'gqlurl');

          // Extract query and operation info
          const query = gqlBodyChild?.attrs?.body || gqlNode.attrs?.body || '';
          let operationType = gqlBodyChild?.attrs?.operationType || gqlNode.attrs?.operationType || 'query';
          let operationName: string | undefined;

          const match = query.match(/^\s*(query|mutation|subscription)\s+([\w]+)?/);
          if (match) {
            operationType = match[1];
            operationName = match[2];
          }

          const variables = parseGraphQLVariablesBody(gqlVariablesNode?.attrs?.body);

          // URL: from gqlurl child text, or legacy attrs.endpoint, or schemaUrl
          const gqlUrlText = gqlUrlChild?.content?.[0]?.text || gqlUrlChild?.content || '';
          const url = (typeof gqlUrlText === 'string' ? gqlUrlText : '') ||
            gqlNode.attrs?.endpoint || gqlNode.attrs?.schemaUrl || '';

          // Merge user headers with required Content-Type default
          const userHeaders = readTableHeaders(editorJson.content, 'headers-table');
          const cookies = readTableHeaders(editorJson.content, 'cookies-table');
          const mergedHeaders = [{ key: 'Content-Type', value: 'application/json', enabled: true }];
          for (const uh of userHeaders) {
            const idx = mergedHeaders.findIndex(h => h.key.toLowerCase() === uh.key.toLowerCase());
            if (idx !== -1) mergedHeaders[idx] = uh;
            else mergedHeaders.push(uh);
          }
          if (cookies.length > 0) {
            const cookieString = cookies.map((c: any) => `${c.key}=${c.value}`).join('; ');
            const cookieIdx = mergedHeaders.findIndex(h => h.key.toLowerCase() === 'cookie');
            if (cookieIdx !== -1) mergedHeaders[cookieIdx].value += '; ' + cookieString;
            else mergedHeaders.push({ key: 'Cookie', value: cookieString, enabled: true });
          }

          const auth = readAuth(editorJson.content);

          // Get pre/post request scripts
          const preRequestBlock = editorJson.content?.find((n: any) => n.type === 'pre_request_block');
          const postRequestBlocks = editorJson.content?.filter((n: any) => n.type === 'post_request_block');

          return {
            ...request,
            protocolType: 'graphql',
            operationType,
            method: 'POST',
            url,
            headers: mergedHeaders,
            body: JSON.stringify({
              query,
              variables,
              operationName,
            }),
            content_type: 'application/json',
            prescript: preRequestBlock?.attrs?.body,
            postscript: postRequestBlocks?.map((n: any) => n.attrs?.body).join('\n'),
            auth,
          };
        } catch (error) {
          console.error('GraphQL onBuildRequest error:', error);
          throw error;
        }
      });

      // Register slash commands
      context.addVoidenSlashGroup({
        name: 'graphql',
        title: 'GraphQL',
        commands: [
          {
            name: 'graphql-query',
            label: 'GraphQL Query',
            aliases: ['gqlquery'],
            compareKeys: ['gqlquery'],
            singleton: true,
            slash: '/gqlquery',
            description: 'Insert GraphQL query block',
            action: (editor: any) => {
              if (!editor) return;
              editor
                .chain()
                .focus()
                .insertContent([
                  {
                    type: 'gqlquery',
                    content: [
                      { type: 'gqlurl', content: [] },
                      { type: 'gqlbody', attrs: { body: '', operationType: 'query' } },
                    ],
                  },
                  {
                    type: 'paragraph',
                  },
                ])
                .run();
            },
          },
          {
            name: 'graphql-variables',
            label: 'GraphQL Variables',
            aliases: ['gqlvariables'],
            slash: '/gqlvariables',
            compareKeys: ['gqlvariables'],
            singleton: true,
            description: 'Insert GraphQL variables block',
            action: (editor: any) => {
              if (!editor) return;
              editor
                .chain()
                .focus()
                .insertContent([
                  {
                    type: 'gqlvariables',
                    attrs: {
                      body: '{\n  \n}',
                    },
                  },
                  {
                    type: 'paragraph',
                  },
                ])
                .run();
            },
          },
        ],
      });

      // Register response processor for all GraphQL responses
      context.onProcessResponse(async (response) => {
        // Only handle GraphQL protocol responses
        if (response.protocol !== 'graphql' && response.protocolType !== 'graphql') {
          return;
        }

        const operationType = response.operationType || 'query';

        // Handle subscriptions
        if (operationType === 'subscription') {
          try {
            const subscriptionId = response.subscriptionId || `sub-${Date.now()}`;

            const { convertSubscriptionResponseToVoidenDoc } = await import('./lib/subscriptionResponseConverter');

            const responseDoc = convertSubscriptionResponseToVoidenDoc({
              subscriptionId,
              url: response.requestMeta?.url || '',
              connected: false,
              requestMeta: response.requestMeta,
            });

            await context.openVoidenTab(
              `Subscription`,
              responseDoc,
            );
          } catch (error) {
            console.error('Failed to process GraphQL subscription response:', error);
          }
          return;
        }

        // Handle query/mutation responses
        try {
          const { convertGraphQLResponseToVoidenDoc } = await import('./lib/responseConverter');

          const responseDoc = convertGraphQLResponseToVoidenDoc({
            statusCode: response.statusCode || response.status || 0,
            statusMessage: response.statusMessage || response.statusText || '',
            headers: response.headers || [],
            body: response.body || response.data,
            contentType: response.contentType,
            elapsedTime: response.elapsedTime || response.time || 0,
            url: response.url,
            requestMeta: response.requestMeta,
            metadata: response.metadata,
          });

          // Attach section info for scroll-to-request linking and color matching
          if (response.__sectionIndex !== undefined && responseDoc?.attrs) {
            responseDoc.attrs.sectionIndex = response.__sectionIndex;
          }
          if (response.__sectionColorIndex !== undefined && responseDoc?.attrs) {
            responseDoc.attrs.sectionColorIndex = response.__sectionColorIndex;
          }
          if (response.__sectionLabel && responseDoc?.attrs) {
            responseDoc.attrs.sectionLabel = response.__sectionLabel;
          }

          await context.openVoidenTab(
            `Response ${response.statusCode || response.status || 0}`,
            responseDoc,
            { readOnly: true }
          );
        } catch (error) {
          console.error('Failed to process GraphQL response:', error);
        }
      });
    },

    metadata: manifest,
  };
}
