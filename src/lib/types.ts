export type ProfileStatus = 'pending' | 'approved' | 'blocked';
export type ProfileRole = 'player' | 'admin';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed';
export type CommunityId = 'dimension-football' | 'athletic-club' | 'electric-league';
export type PredictionPhase = 'groups' | 'scorer' | 'knockout';

export interface PredictionUnlocks {
  groups_until?: string | null;
  scorer_until?: string | null;
  knockout_until?: string | null;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  role: ProfileRole;
  status: ProfileStatus;
  community_id?: CommunityId;
  total_points: number;
  points_groups: number;
  points_knockout: number;
  points_scorer: number;
  points_qualified: number;
  previous_rank?: number | null;
  current_rank?: number | null;
  prediction_unlocks?: PredictionUnlocks | null;
  created_at?: string;
  updated_at?: string;
}

export interface CommunityMembership {
  user_id: string;
  community_id: CommunityId;
  role: ProfileRole;
  status: ProfileStatus;
  total_points: number;
  points_groups: number;
  points_knockout: number;
  points_scorer: number;
  points_qualified: number;
  previous_rank?: number | null;
  current_rank?: number | null;
  prediction_unlocks?: PredictionUnlocks | null;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
}

export interface CommunitySettings {
  community_id: CommunityId;
  bizum_recipient: string;
  entry_fee_eur: number;
  prize_distribution: {
    phase1Champion: number;
    phase2Champion: number;
    globalChampion: number;
    globalRunnerUp: number;
    globalThird: number;
  };
  groups_deadline_at?: string | null;
  scorer_deadline_at?: string | null;
  knockout_deadline_at?: string | null;
  notes?: string | null;
  updated_at?: string;
}

export interface Match {
  id: string;
  fifa_match_id: string;
  match_number: number | null;
  round_number: number | null;
  phase: string;
  group_code: string | null;
  stage_name: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team_name: string;
  away_team_name: string;
  home_team_code: string | null;
  away_team_code: string | null;
  kickoff_at: string;
  local_kickoff_at: string | null;
  venue: string | null;
  city: string | null;
  tv_channel_es?: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_penalty_score: number | null;
  away_penalty_score: number | null;
  winner_team_id: string | null;
  raw?: unknown;
  synced_at?: string;
}

export interface MatchPrediction {
  id?: number;
  user_id: string;
  community_id?: CommunityId;
  match_id: string;
  home_score: number;
  away_score: number;
  points_awarded?: number;
  updated_at?: string;
}

export interface KnockoutPrediction {
  user_id: string;
  community_id?: CommunityId;
  match_id: string;
  predicted_home_team_id: string | null;
  predicted_home_team_name: string | null;
  predicted_home_team_code: string | null;
  predicted_away_team_id: string | null;
  predicted_away_team_name: string | null;
  predicted_away_team_code: string | null;
  predicted_home_score?: number | null;
  predicted_away_score?: number | null;
  points_awarded?: number;
  updated_at?: string;
}

export interface GroupPrediction {
  user_id: string;
  community_id?: CommunityId;
  group_code: string;
  first_team_id: string | null;
  first_team_name: string | null;
  first_team_code: string | null;
  second_team_id: string | null;
  second_team_name: string | null;
  second_team_code: string | null;
  updated_at?: string;
}

export interface ScorerPrediction {
  user_id: string;
  community_id?: CommunityId;
  player_name: string;
  team_id: string | null;
  team_name: string | null;
  team_code: string | null;
  updated_at?: string;
}

export interface FinalistPrediction {
  user_id: string;
  community_id?: CommunityId;
  champion_team_id: string | null;
  champion_team_name: string | null;
  champion_team_code: string | null;
  runner_up_team_id: string | null;
  runner_up_team_name: string | null;
  runner_up_team_code: string | null;
  third_team_id: string | null;
  third_team_name: string | null;
  third_team_code: string | null;
  fourth_team_id: string | null;
  fourth_team_name: string | null;
  fourth_team_code: string | null;
  updated_at?: string;
}

export interface PointEvent {
  id: number;
  user_id: string;
  community_id?: CommunityId;
  category: 'groups' | 'knockout' | 'scorer' | 'qualified';
  points: number;
  ref_type: string;
  ref_id: string;
  label: string | null;
  created_at?: string;
}

export interface Team {
  id: string;
  code: string;
  name: string;
  group_code: string | null;
  flag_url: string | null;
}
