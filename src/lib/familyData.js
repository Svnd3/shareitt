import { supabase } from "./supabaseClient";

const FAMILY_COLUMNS =
  "id,service_name,host_name,host_phone,price_per_slot,total_slots,filled_slots,is_verified,is_live,whatsapp_group_link,logo_url,unique_name,group_description,created_by,created_at";

// Groups a user hosts. Used by the Account page — kept separate from
// Host.jsx's own loadHostData (which also fetches per-group member lists)
// since that function has more moving parts than an account summary needs.
export async function fetchHostedFamilies(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("families")
    .select(FAMILY_COLUMNS)
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  return error || !data ? [] : data;
}

// Groups a user has joined (as a member, not the host).
export async function fetchJoinedFamilies(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("members")
    .select(`family_id, families(${FAMILY_COLUMNS})`)
    .eq("user_id", userId);

  if (error || !data) return [];
  return data.map((row) => row.families).filter(Boolean);
}
