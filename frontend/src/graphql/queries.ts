import { gql } from "@apollo/client";

export const Q_AGG_BY_SEVERITY = gql`
  query AggBySeverity {
    aggBySeverity {
      severity
      totalIncidents
      avgRiskScore
    }
  }
`;

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

export const Q_DOCS = gql`
  query Docs($limit: Int) {
    docs(limit: $limit) {
      id
      mapperVersion
      createdAt
    }
  }
`;
