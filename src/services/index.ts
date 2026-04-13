export * from './cache.service';
export * from './espn-odds.service';
export * from './espn-stats.service';
export * from './odds-api.service';
export * from './sofascore.service';

// ESPN qualitative — solo exporta el servicio, no los types (evita duplicados con espn-stats)
export { ESPNQualitativeService } from './espn-qualitative.service';
export type {
  ESPNNewsItem,
  ESPNInjury,
  ESPNStandingsEntry,
  ESPNTeamFormSummary,
  ESPNScheduleEvent,
  QualitativeContext,
} from './espn-qualitative.service';
