import { supabase } from "./supabaseClient";

const FAMILY_COLUMNS =
  "id,service_name,host_name,host_phone,price_per_slot,total_slots,filled_slots,is_verified,is_live,whatsapp_group_link,logo_url,unique_name,group_description,created_by,created_at,deleted_at";

// Groups a user hosts. Used by the Account page — kept separate from
// Host.jsx's own loadHostData (which also fetches per-group member lists)
// since that function has more moving parts than an account summary needs.
export async function fetchHostedFamilies(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("families")
    .select(FAMILY_COLUMNS)
    .eq("created_by", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return error || !data ? [] : data;
}

// Groups a user has joined (as a member, not the host). Filters out a
// membership the user has since left/been removed from (deleted_at set),
// and — since PostgREST can't filter a column on the embedded families(...)
// resource in the same query — drops any family that's been soft-deleted
// after the fact client-side.
export async function fetchJoinedFamilies(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("members")
    .select(`family_id, families(${FAMILY_COLUMNS})`)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error || !data) return [];
  return data
    .map((row) => row.families)
    .filter((family) => family && !family.deleted_at);
}

// Every active group ever formed on ShareIt, regardless of who hosts it —
// RLS only lets this actually return every row for the admin accounts in
// families_update_own/members_select_own_or_host (see
// supabase_rls_policies.sql); everyone else just gets their own listings
// back, same as fetchHostedFamilies.
export async function fetchAllFamilies() {
  const { data, error } = await supabase
    .from("families")
    .select(FAMILY_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return error || !data ? [] : data;
}

// Soft-deleted families — admin-only "Deleted" trash view (RLS still governs
// what a non-admin session would get back, same as fetchAllFamilies).
export async function fetchDeletedFamilies() {
  const { data, error } = await supabase
    .from("families")
    .select(FAMILY_COLUMNS)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return error || !data ? [] : data;
}

// Active member rows for a set of families, grouped by family_id — used to
// show each group's real joiners (name, phone, socials) in the admin "All
// groups" view. Relies on the same admin RLS carve-out as fetchAllFamilies.
export async function fetchMembersByFamilyIds(familyIds) {
  if (!familyIds.length) return {};

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .in("family_id", familyIds)
    .is("deleted_at", null);

  if (error || !data) return {};

  return data.reduce((acc, member) => {
    acc[member.family_id] = [...(acc[member.family_id] || []), member];
    return acc;
  }, {});
}

// Soft-deleted member rows for a set of families, grouped by family_id —
// admin-only "Deleted" trash view.
export async function fetchDeletedMembersByFamilyIds(familyIds) {
  if (!familyIds.length) return {};

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .in("family_id", familyIds)
    .not("deleted_at", "is", null);

  if (error || !data) return {};

  return data.reduce((acc, member) => {
    acc[member.family_id] = [...(acc[member.family_id] || []), member];
    return acc;
  }, {});
}
