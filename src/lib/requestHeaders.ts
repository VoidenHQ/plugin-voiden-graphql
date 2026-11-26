/**
 * Reads the headers / cookies / auth blocks of a request out of the editor
 * JSON. Shared by the request builder (plugin.ts) and schema introspection,
 * so a schema fetch reaches the same endpoint with the same credentials a
 * normal run would.
 */

export interface DocNode {
  type?: string;
  attrs?: Record<string, any>;
  content?: DocNode[];
  text?: string;
}

export interface HeaderRow {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestAuth {
  enabled: boolean;
  type: string;
  config: Record<string, any>;
}

/** Read headers from the TipTap table structure (headers-table > table > tableRow > tableCell). */
export function readTableHeaders(content: DocNode[] | undefined, type: string): HeaderRow[] {
  const result: HeaderRow[] = [];
  content?.forEach((rootNode) => {
    if (rootNode.type !== type) return;
    rootNode.content?.forEach((node) => {
      if (node.type !== 'table') return;
      node.content?.forEach((rowNode) => {
        if (rowNode.type !== 'tableRow' || rowNode.attrs?.disabled) return;
        let key = '', value = '';
        rowNode.content?.forEach((cellNode, cellIndex) => {
          if (cellNode.type === 'tableCell') {
            const text = (cellNode.content?.[0]?.content?.[0]?.text || '').trim();
            if (cellIndex === 0) key = text;
            else if (cellIndex === 1) value = text;
          }
        });
        if (key) result.push({ key, value, enabled: true });
      });
    });
  });
  return result;
}

/** Read the auth node and map it to the orchestrator format. */
export function readAuth(content: DocNode[] | undefined): RequestAuth | undefined {
  const authNode = content?.find((n) => n.type === 'auth');
  if (!authNode?.attrs) return undefined;
  const authType = authNode.attrs.authType;
  if (!authType || authType === 'inherit' || authType === 'none') return undefined;
  const typeMapping: Record<string, string> = {
    bearer: 'bearer-token', basic: 'basic-auth', apiKey: 'api-key',
    oauth2: 'oauth2', oauth1: 'oauth1', digest: 'digest-auth',
    ntlm: 'ntlm', awsSignature: 'aws-signature', hawk: 'hawk',
  };
  const mappedType = typeMapping[authType];
  if (!mappedType) return undefined;
  const config: Record<string, string> = {};
  authNode.content?.forEach((node) => {
    if (node.type === 'table') {
      node.content?.forEach((rowNode) => {
        if (rowNode.type === 'tableRow') {
          let k = '', v = '';
          rowNode.content?.forEach((cellNode, idx) => {
            if (cellNode.type === 'tableCell') {
              const text = (cellNode.content?.[0]?.content?.[0]?.text || '').trim();
              if (idx === 0) k = text; else if (idx === 1) v = text;
            }
          });
          if (k) config[k] = v;
        }
      });
    }
  });
  let finalConfig: any = config;
  if (authType === 'bearer') finalConfig = { token: config.token || '' };
  else if (authType === 'basic') finalConfig = { username: config.username || '', password: config.password || '' };
  else if (authType === 'apiKey') finalConfig = { key: config.key || '', value: config.value || '', in: config.add_to || 'header' };
  else if (authType === 'oauth2') {
    let oauth2Attrs: any = {};
    try {
      const raw = authNode.attrs?.oauth2Config;
      if (raw) oauth2Attrs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {}
    const varPrefix = oauth2Attrs.variablePrefix || 'oauth2';
    finalConfig = {
      accessToken: `{{process.${varPrefix}_access_token}}`,
      tokenType: `{{process.${varPrefix}_token_type}}`,
      headerPrefix: oauth2Attrs.headerPrefix || 'Bearer',
      addTokenTo: oauth2Attrs.addTokenTo || 'header',
      autoRefresh: oauth2Attrs.autoRefresh === true,
      variablePrefix: varPrefix,
      grantType: oauth2Attrs.grantType || 'authorization_code',
      tokenUrl: config.token_url || oauth2Attrs.tokenUrl || '',
      clientId: config.client_id || oauth2Attrs.clientId || '',
      clientSecret: config.client_secret || oauth2Attrs.clientSecret || '',
      scope: config.scope || '',
      refreshToken: `{{process.${varPrefix}_refresh_token}}`,
    };
  }
  return { enabled: true, type: mappedType, config: finalConfig };
}

/**
 * The slice of the document that makes up one request: the nodes around the
 * gqlquery with the given uid, up to the neighbouring request-separators.
 * A multi-request file keeps each request's auth/headers in its own section.
 */
export function sectionContent(content: DocNode[] | undefined, queryUid?: string): DocNode[] {
  if (!content?.length) return [];
  const qIdx = content.findIndex((n) => n.type === 'gqlquery' && (!queryUid || n.attrs?.uid === queryUid));
  if (qIdx < 0) return content;
  let start = qIdx;
  while (start > 0 && content[start - 1].type !== 'request-separator') start--;
  let end = qIdx;
  while (end < content.length - 1 && content[end + 1].type !== 'request-separator') end++;
  return content.slice(start, end + 1);
}

/**
 * Headers and query params for an introspection request against `section`:
 * Content-Type, the request's header and cookie blocks, and credentials from
 * its auth block. Bearer, basic and API-key auth are applied; other auth types
 * need the app's own request pipeline and are not sent for introspection.
 * {{variables}} are left raw — sendSecure resolves them.
 */
export function buildIntrospectionRequestParts(section: DocNode[]): {
  headers: HeaderRow[];
  queryParams: HeaderRow[];
} {
  const headers: HeaderRow[] = [];
  const queryParams: HeaderRow[] = [];
  const setHeader = (key: string, value: string) => {
    const idx = headers.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
    if (idx !== -1) headers[idx] = { key, value, enabled: true };
    else headers.push({ key, value, enabled: true });
  };

  const auth = readAuth(section);
  if (auth?.enabled) {
    if (auth.type === 'bearer-token' && auth.config.token) {
      setHeader('Authorization', `Bearer ${auth.config.token}`);
    } else if (auth.type === 'basic-auth') {
      const credentials = `${auth.config.username}:${auth.config.password}`;
      // Variables can't be resolved before encoding; skip rather than send a bogus value.
      if (!credentials.includes('{{')) setHeader('Authorization', `Basic ${btoa(credentials)}`);
    } else if (auth.type === 'api-key' && auth.config.key) {
      if (auth.config.in === 'query') queryParams.push({ key: auth.config.key, value: auth.config.value || '', enabled: true });
      else setHeader(auth.config.key, auth.config.value || '');
    }
  }

  setHeader('Content-Type', 'application/json');
  for (const row of readTableHeaders(section, 'headers-table')) setHeader(row.key, row.value);

  const cookies = readTableHeaders(section, 'cookies-table');
  if (cookies.length > 0) {
    const cookieString = cookies.map((c) => `${c.key}=${c.value}`).join('; ');
    const existing = headers.find((h) => h.key.toLowerCase() === 'cookie');
    if (existing) existing.value += '; ' + cookieString;
    else headers.push({ key: 'Cookie', value: cookieString, enabled: true });
  }

  return { headers, queryParams };
}
