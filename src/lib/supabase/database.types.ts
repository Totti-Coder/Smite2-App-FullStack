export type Role = 'solo' | 'jungle' | 'mid' | 'adc' | 'support';
export type DamageType = 'strength' | 'intelligence';
export type GameMode =
  | 'conquest_ranked'
  | 'conquest_casual'
  | 'arena'
  | 'joust'
  | 'assault'
  | 'duel';
export type MatchResult = 'win' | 'loss';

export type God = {
  id: string;
  name: string;
  pantheon: string;
  primary_role: Role;
  damage_type: DamageType;
  icon_url: string | null;
  created_at: string;
};

export type Match = {
  id: string;
  user_id: string;
  god_id: string;
  enemy_god_id: string | null;
  role_played: Role;
  game_mode: GameMode;
  result: MatchResult;
  kills: number;
  deaths: number;
  assists: number;
  rank_tier: string | null;
  duration_seconds: number | null;
  gold_per_min: number | null;
  damage_to_players: number | null;
  damage_to_minions: number | null;
  damage_to_jungle: number | null;
  damage_to_structures: number | null;
  damage_taken: number | null;
  damage_mitigated: number | null;
  self_healing: number | null;
  ally_healing: number | null;
  wards_placed: number | null;
  items: string[] | null;
  screenshot_path: string | null;
  played_at: string;
  notes: string | null;
  created_at: string;
};

export type MatchParticipant = {
  id: string;
  match_id: string;
  side: 'ally' | 'enemy';
  god_id: string | null;
  role: Role | null;
  items: string[] | null;
  created_at: string;
};

export type GodAbility = {
  id: string;
  god_id: string;
  sort_order: number;
  name: string;
  ability_type: string;
  description: string;
  icon_url: string | null;
  stats: {
    levelStats: Record<string, number[]>;
    namedFormulas: Record<string, string>;
    namedValueScalings: Record<string, { values: number[]; statTag: string }[]>;
  } | null;
  notes: string | null;
  created_at: string;
};

export type TierListRow = {
  id: string;
  user_id: string;
  title: string;
  author_name: string;
  tiers: { id: string; label: string; color: string; godIds: string[] }[];
  created_at: string;
  updated_at: string;
};

export type SteamPlayerSnapshot = {
  id: string;
  player_count: number;
  sampled_at: string;
};

export type Database = {
  public: {
    Tables: {
      gods: {
        Row: God;
        Insert: Omit<God, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<God, 'id'>>;
        Relationships: [];
      };
      matches: {
        Row: Match;
        Insert: Omit<Match, 'id' | 'user_id' | 'created_at'> & {
          id?: string;
          user_id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Match, 'id' | 'user_id'>>;
        Relationships: [
          {
            foreignKeyName: 'matches_god_id_fkey';
            columns: ['god_id'];
            isOneToOne: false;
            referencedRelation: 'gods';
            referencedColumns: ['id'];
          },
        ];
      };
      match_participants: {
        Row: MatchParticipant;
        Insert: Omit<MatchParticipant, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<MatchParticipant, 'id'>>;
        Relationships: [
          {
            foreignKeyName: 'match_participants_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
        ];
      };
      steam_player_snapshots: {
        Row: SteamPlayerSnapshot;
        Insert: Omit<SteamPlayerSnapshot, 'id' | 'sampled_at'> & { id?: string; sampled_at?: string };
        Update: Partial<Omit<SteamPlayerSnapshot, 'id'>>;
        Relationships: [];
      };
      tier_lists: {
        Row: TierListRow;
        Insert: Omit<TierListRow, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TierListRow, 'id' | 'user_id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
