export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ScoringDirection = 'higher_is_better' | 'lower_is_better';
export type SessionStatus = 'lobby' | 'active' | 'paused' | 'finished';

export interface Database {
	public: {
		Tables: {
			players: {
				Row: { id: string; name: string; pin: string; alias: string | null; created_at: string };
				Insert: { id?: string; name: string; pin: string; alias?: string | null; created_at?: string };
				Update: { id?: string; name?: string; pin?: string; alias?: string | null; created_at?: string };
				Relationships: [];
			};
			games: {
				Row: {
					id: string;
					name: string;
					url: string | null;
					icon_emoji: string | null;
					scoring_direction: ScoringDirection;
					max_score: number | null;
					share_parser: string | null;
					share_regex: string | null;
					allow_dnf: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					url?: string | null;
					icon_emoji?: string | null;
					scoring_direction: ScoringDirection;
					max_score?: number | null;
					share_parser?: string | null;
					share_regex?: string | null;
					allow_dnf?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					url?: string | null;
					icon_emoji?: string | null;
					scoring_direction?: ScoringDirection;
					max_score?: number | null;
					share_parser?: string | null;
					share_regex?: string | null;
					allow_dnf?: boolean;
					created_at?: string;
				};
				Relationships: [];
			};
			sessions: {
				Row: { id: string; name: string; date: string; status: SessionStatus; expires_at: string | null; scores_hidden: boolean; created_at: string };
				Insert: { id?: string; name: string; date?: string; status?: SessionStatus; expires_at?: string | null; scores_hidden?: boolean; created_at?: string };
				Update: { id?: string; name?: string; date?: string; status?: SessionStatus; expires_at?: string | null; scores_hidden?: boolean; created_at?: string };
				Relationships: [];
			};
			session_games: {
				Row: { id: string; session_id: string; game_id: string; sort_order: number };
				Insert: { id?: string; session_id: string; game_id: string; sort_order?: number };
				Update: { id?: string; session_id?: string; game_id?: string; sort_order?: number };
				Relationships: [
					{ foreignKeyName: 'session_games_session_id_fkey'; columns: ['session_id']; referencedRelation: 'sessions'; referencedColumns: ['id'] },
					{ foreignKeyName: 'session_games_game_id_fkey'; columns: ['game_id']; referencedRelation: 'games'; referencedColumns: ['id'] }
				];
			};
			scores: {
				Row: {
					id: string;
					session_id: string;
					game_id: string;
					player_id: string;
					raw_score: number;
					share_text: string | null;
					submitted_at: string;
				};
				Insert: {
					id?: string;
					session_id: string;
					game_id: string;
					player_id: string;
					raw_score: number;
					share_text?: string | null;
					submitted_at?: string;
				};
				Update: {
					id?: string;
					session_id?: string;
					game_id?: string;
					player_id?: string;
					raw_score?: number;
					share_text?: string | null;
					submitted_at?: string;
				};
				Relationships: [
					{ foreignKeyName: 'scores_session_id_fkey'; columns: ['session_id']; referencedRelation: 'sessions'; referencedColumns: ['id'] },
					{ foreignKeyName: 'scores_game_id_fkey'; columns: ['game_id']; referencedRelation: 'games'; referencedColumns: ['id'] },
					{ foreignKeyName: 'scores_player_id_fkey'; columns: ['player_id']; referencedRelation: 'players'; referencedColumns: ['id'] }
				];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

export type Player = Database['public']['Tables']['players']['Row'];
export type Game = Database['public']['Tables']['games']['Row'];
export type Session = Database['public']['Tables']['sessions']['Row'];
export type SessionGame = Database['public']['Tables']['session_games']['Row'];
export type Score = Database['public']['Tables']['scores']['Row'];

export type GameWithDetails = Game & { session_games?: SessionGame[] };
export type SessionWithGames = Session & { session_games: (SessionGame & { game: Game })[] };
export type ScoreWithPlayer = Score & { player: Player };
