
import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL =
  "https://llgpyduajegkoylpmtij.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_B0yWXgx_hTCJcZMD6gQtdQ_Yf0uUXLP";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
