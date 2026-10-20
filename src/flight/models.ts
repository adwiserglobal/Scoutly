export type FlightModelId = 'plane' | 'jet' | 'heli-city' | 'heli-rescue';

export interface FlightModelProfile {
  id: FlightModelId;
  name: string;
  tagline: string;
  kind: 'plane' | 'heli';
  cruise: number; // m/s
  minSpeed: number;
  maxSpeed: number; // with boost
  turnRate: number; // deg/s
  bank: number; // rad at full turn
  climbRate: number; // m/s
  altitude: number; // start altitude, m
  minAltitude: number;
  maxAltitude: number;
  scale: number; // model units -> meters
  stats: { speed: number; agility: number; view: number }; // 1..5 for the picker
}

export const FLIGHT_MODELS: FlightModelProfile[] = [
  {
    id: 'plane', name: 'Monomotor Scoutly', tagline: 'Equilibrado, ótimo para começar',
    kind: 'plane', cruise: 90, minSpeed: 40, maxSpeed: 230, turnRate: 62, bank: 0.62,
    climbRate: 55, altitude: 55, minAltitude: 25, maxAltitude: 420, scale: 12,
    stats: { speed: 3, agility: 3, view: 3 },
  },
  {
    id: 'jet', name: 'Jato Falcão', tagline: 'Rápido, para varrer a cidade',
    kind: 'plane', cruise: 130, minSpeed: 75, maxSpeed: 320, turnRate: 72, bank: 0.85,
    climbRate: 85, altitude: 80, minAltitude: 35, maxAltitude: 520, scale: 12,
    stats: { speed: 5, agility: 4, view: 2 },
  },
  {
    id: 'heli-city', name: 'Helicóptero Urbano', tagline: 'Paira no ar e gira no lugar',
    kind: 'heli', cruise: 38, minSpeed: 0, maxSpeed: 105, turnRate: 95, bank: 0.32,
    climbRate: 40, altitude: 38, minAltitude: 15, maxAltitude: 260, scale: 11,
    stats: { speed: 2, agility: 5, view: 5 },
  },
  {
    id: 'heli-rescue', name: 'Helicóptero Resgate', tagline: 'Estável e veloz para o porte',
    kind: 'heli', cruise: 52, minSpeed: 0, maxSpeed: 130, turnRate: 78, bank: 0.28,
    climbRate: 48, altitude: 45, minAltitude: 15, maxAltitude: 300, scale: 11,
    stats: { speed: 3, agility: 4, view: 5 },
  },
];

export const getFlightModel = (id: string | null | undefined) =>
  FLIGHT_MODELS.find((model) => model.id === id) || FLIGHT_MODELS[0];
