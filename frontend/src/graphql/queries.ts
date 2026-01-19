import { gql } from "@apollo/client";

// =============================================================================
// Aggregations (Dashboard KPIs / charts)
// =============================================================================

/**
 * Aggregate incidents by severity.
 * Used for severity distribution charts and risk overview widgets.
 */
export const Q_AGG_BY_SEVERITY = gql`
  query AggBySeverity {
    aggBySeverity {
      severity
      totalIncidents
      avgRiskScore
    }
  }
`;

/**
 * Aggregate incidents by incident type.
 * Used for "by type" charts and estimated cost breakdowns.
 */
export const Q_AGG_BY_TYPE = gql`
  query AggByType {
    aggByType {
      incidentType
      totalIncidents
      avgRiskScore
      totalEstimatedCostEur
    }
  }
`;

// =============================================================================
// Incidents (lists / tables / maps)
// =============================================================================

/**
 * Lightweight incidents query for sampling (e.g., dashboard cards, quick previews).
 * Keeps payload small by selecting only the fields needed by summary widgets.
 */
export const Q_INCIDENTS_SAMPLE = gql`
  query IncidentsSample($limit: Int) {
    incidents(limit: $limit) {
      incidentId
      country
      estimatedCostEur
      riskScore
    }
  }
`;

/**
 * Full incidents query with optional filters + pagination.
 * Used by the main incidents page (table + filters) and any map view requiring
 * location/time/status fields.
 */
export const Q_INCIDENTS = gql`
  query Incidents(
    $docId: Int
    $type: String
    $severity: String
    $status: String
    $country: String
    $limit: Int
    $offset: Int
  ) {
    incidents(
      docId: $docId
      type: $type
      severity: $severity
      status: $status
      country: $country
      limit: $limit
      offset: $offset
    ) {
      docId
      incidentId
      source
      incidentType
      severity
      status
      city
      country
      continent
      lat
      lon
      reportedAt
      validatedAt
      resolvedAt
      lastUpdateUtc
      assignedUnit
      resourcesCount
      etaMin
      responseTimeMin
      estimatedCostEur
      riskScore
      notes
    }
  }
`;

// =============================================================================
// Documents (stored XML documents metadata)
// =============================================================================

/**
 * List stored XML documents (latest first).
 * Used by the Docs page to show ingestion history and available datasets.
 */
export const Q_DOCS = gql`
  query Docs($limit: Int) {
    docs(limit: $limit) {
      id
      mapperVersion
      createdAt
    }
  }
`;