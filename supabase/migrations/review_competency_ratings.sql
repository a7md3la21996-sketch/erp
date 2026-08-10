-- Add per-competency ratings JSONB and computed weighted score to performance reviews
-- competency_ratings stores { "<competency_key>": <rating 1-5>, ... }
-- weighted_score = SUM(rating * weight) / SUM(weight) across rated competencies
ALTER TABLE performance_reviews
  ADD COLUMN IF NOT EXISTS competency_ratings JSONB DEFAULT '{}'::jsonb;

ALTER TABLE performance_reviews
  ADD COLUMN IF NOT EXISTS weighted_score NUMERIC(4,2);
