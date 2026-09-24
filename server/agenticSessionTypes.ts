export type AgenticResolvedIntent = {
  segment: string;
  canonicalQuery: string;
  location: string | null;
  regionName: string;
  filters: string[];
};
