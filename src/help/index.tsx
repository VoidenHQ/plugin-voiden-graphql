export const GraphQLQueryHelp = () => (
  <div className="space-y-4">
    <section>
      <h3 className="font-semibold mb-2 text-text">GraphQL Query</h3>
      <p className="text-sm text-comment mb-3">
        Lets you tell a GraphQL API exactly what you need, in one request — no separate endpoints to
        manage, and no trimming unwanted fields out of the response afterward.
      </p>
    </section>

    <section>
      <h4 className="font-semibold mb-2 text-text">Loading a Schema</h4>
      <ul className="list-disc list-inside space-y-1 text-sm text-comment">
        <li><strong>Import a schema file</strong> — a local <code className="bg-accent/10 px-1 rounded text-text">.graphql</code>/<code className="bg-accent/10 px-1 rounded text-text">.gql</code> file, good for offline work and version-controlled setups</li>
        <li><strong>Introspection</strong> — point at a live endpoint URL and Voiden queries it for all available types/queries/mutations/subscriptions</li>
      </ul>
    </section>

    <section>
      <h4 className="font-semibold mb-2 text-text">How to Use</h4>
      <ol className="list-decimal list-inside space-y-1 text-sm text-comment">
        <li>Insert with <code className="bg-accent/10 px-1 rounded text-text">/gqlquery</code></li>
        <li>Set the endpoint URL (or import a schema/use introspection for autocomplete)</li>
        <li>Write the query/mutation/subscription body</li>
        <li>Add a <strong>GraphQL Variables</strong> block alongside it for any dynamic arguments</li>
        <li>Run with Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux), or the Play button</li>
      </ol>
    </section>

    <section>
      <h4 className="font-semibold mb-2 text-text">Example</h4>
      <pre className="bg-accent/10 p-2 rounded text-xs overflow-x-auto text-text">
{`query GetUser($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
  }
}`}
      </pre>
    </section>
  </div>
);

export const GraphQLVariablesHelp = () => (
  <div className="space-y-4">
    <section>
      <h3 className="font-semibold mb-2 text-text">GraphQL Variables</h3>
      <p className="text-sm text-comment mb-3">
        Supplies dynamic values (IDs, filters, user input) to a paired Query block, instead of
        hardcoding them into the query body — keeping queries reusable and easy to test with
        different inputs.
      </p>
    </section>

    <section>
      <h4 className="font-semibold mb-2 text-text">How to Use</h4>
      <ol className="list-decimal list-inside space-y-1 text-sm text-comment">
        <li>Insert with <code className="bg-accent/10 px-1 rounded text-text">/gqlvariables</code> — appears as a JSON editor</li>
        <li>Fill in values by hand, or reference environment/runtime variables with <code className="bg-accent/10 px-1 rounded text-text">{`{{variable_name}}`}</code></li>
        <li>Keys must match the variable names declared in the paired query, e.g. <code className="bg-accent/10 px-1 rounded text-text">$userId</code></li>
        <li>Run with Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux), or the Play button</li>
      </ol>
    </section>

    <section>
      <h4 className="font-semibold mb-2 text-text">Example</h4>
      <pre className="bg-accent/10 p-2 rounded text-xs overflow-x-auto text-text">
{`{
  "userId": "{{USER_ID}}"
}`}
      </pre>
    </section>
  </div>
);
