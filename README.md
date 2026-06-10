> A plugin for [Voiden](https://github.com/VoidenHQ) — the developer-first API client.

# Voiden GraphQL

GraphQL client with schema importer for building queries through a dedicated UI or writing them manually. Supports queries, mutations, and subscriptions with variables.

## Features

- Schema file importer — load `.graphql` / `.gql` schema files
- Visual query builder UI with operation and field selection
- Field-level argument selection with automatic variable generation
- Separate query and variables blocks
- Operation type support (query / mutation / subscription)
- Variable editor with JSON validation
- Standalone request building with auto-generated `Content-Type` and `POST` method
- Schema viewer with tabs for Query / Mutation / Subscription operations
- Auto-generation of queries from UI selections

## Usage

Use the `/gqlquery` slash command to insert a GraphQL query block, then add a `/gqlvariables` block below it for variables.

Load a schema file with the **Import Schema** button in the query block header to enable the visual builder and introspection-powered autocomplete.

Multiple requests in one file are separated by a `request-separator` block — each gql-query and its paired gql-variable are scoped to their own section.
