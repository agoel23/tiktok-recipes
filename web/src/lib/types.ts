export type SourceType = "tiktok" | "instagram" | "web";

export interface Ingredient {
  group: string | null;
  quantity: number | null;
  unit: string | null;
  item: string;
  note: string | null;
  scalable: boolean;
  estimated: boolean;
}

export interface Step {
  text: string;
  timer_minutes: number | null;
}

export interface Recipe {
  id: string;
  source_type: SourceType;
  source_id: string;
  source_url: string;
  source_name: string | null;
  author: string | null;
  title: string;
  thumbnail_path: string | null;
  cuisine: string;
  tags: string[];
  base_servings: number;
  servings_estimated: boolean;
  measurements_source: "explicit" | "mixed" | "estimated";
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  time_estimated: boolean;
  ingredients: Ingredient[];
  steps: Step[];
  notes: string | null;
  created_at: string;
}

export type JobStatus = "queued" | "processing" | "done" | "failed" | "not_recipe";

export interface Job {
  id: string;
  kind: "import" | "reextract";
  url: string;
  source_type: SourceType;
  status: JobStatus;
  error: string | null;
  manual_text: string | null;
  recipe_id: string | null;
  created_at: string;
  updated_at: string;
}
