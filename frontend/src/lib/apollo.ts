import { ApolloClient, InMemoryCache } from "@apollo/client";
import { HttpLink } from "@apollo/client/link/http";

// =============================================================================
// Apollo Client configuration
// =============================================================================

/**
 * HTTP transport used by Apollo to reach the GraphQL API.
 * In dev: Vite proxy forwards "/graphql/" to the BI service (localhost:4000).
 * In prod (Docker): Nginx proxies "/graphql/" to "bi-service:4000/graphql/".
 */
const httpLink = new HttpLink({ uri: "/graphql/" });

/**
 * Shared Apollo Client instance for the entire frontend.
 * The InMemoryCache enables normalized caching of GraphQL results.
 */
export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
