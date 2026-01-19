import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { apolloClient } from "./lib/apollo";

import "./styles/theme.css";
import "./styles/globals.css";
import "./styles/helpers.css";

// =============================================================================
// React bootstrap
// =============================================================================
// Creates the React root and wires up the app-level providers:
// - ApolloProvider: GraphQL client (queries/mutations/cache)
// - BrowserRouter: client-side routing (React Router)
// - StrictMode: extra checks/warnings in development builds
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>
);