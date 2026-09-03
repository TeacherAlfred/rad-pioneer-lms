export type StravaSummaryActivity = {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number | null;
  average_speed: number | null;
  max_speed: number | null;
  average_cadence: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  suffer_score: number | null;
  kudos_count: number | null;
  achievement_count: number | null;
  pr_count: number | null;
  gear_id: string | null;
  workout_type: number | null;
};

export type StravaSplitMetric = {
  distance: number;
  elapsed_time: number;
  elevation_difference: number | null;
  moving_time: number;
  split: number;
  average_speed: number;
  pace_zone: number | null;
};

export type StravaBestEffort = {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  start_date_local: string;
  pr_rank: number | null;
};

export type StravaDetailedActivity = StravaSummaryActivity & {
  description: string | null;
  calories: number | null;
  splits_metric: StravaSplitMetric[] | null;
  best_efforts: StravaBestEffort[] | null;
};

export type StravaGear = {
  id: string;
  brand_name: string | null;
  model_name: string | null;
  name: string | null;
  distance: number;
  retired: boolean;
};
