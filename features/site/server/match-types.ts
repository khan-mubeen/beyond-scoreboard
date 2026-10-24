// liiga and engine types the site server reads, in one place
export { describeGoalTypes } from "@/features/liiga";
export type { LiigaFixture, LiigaGame, LiigaGameStats, LiigaLineups } from "@/features/liiga";

/** a point on a chance timeline (features/stakes TimelinePoint) */
export interface TimelineLike {
  label: string;
  chance: number;
  delta: number;
  goalId?: string;
}
