#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import process from "process";

// Usage:
// SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/fill_families.mjs

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
  );
  console.error(
    "Run with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/fill_families.mjs",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function randomKenyanPhone() {
  // Produce a Kenyan-style mobile number like 0712345678
  const num = Math.floor(Math.random() * 100000000); // 8 digits
  return "07" + num.toString().padStart(8, "0");
}

async function main() {
  console.log("Fetching families...");
  const { data: families, error: famErr } = await supabase
    .from("families")
    .select("*");
  if (famErr) {
    console.error("Failed to fetch families:", famErr);
    process.exit(1);
  }

  for (const family of families) {
    try {
      const { data: members } = await supabase
        .from("members")
        .select("id")
        .eq("family_id", family.id);
      const current = Array.isArray(members) ? members.length : 0;
      const toAdd = Math.max(0, family.total_slots - current);

      if (toAdd === 0) {
        console.log(
          `Family ${family.service_name} (${family.id}) already full (${current}/${family.total_slots}).`,
        );
        continue;
      }

      const newMembers = [];
      for (let i = 1; i <= toAdd; i++) {
        const idx = current + i;
        newMembers.push({
          family_id: family.id,
          user_id: null,
          name: `${family.service_name} member ${idx}`,
          phone: randomKenyanPhone(),
          email: null,
          payment_confirmed: true,
        });
      }

      console.log(
        `Inserting ${newMembers.length} members into family ${family.service_name} (${family.id})...`,
      );
      const { data: inserted, error: insertErr } = await supabase
        .from("members")
        .insert(newMembers)
        .select();
      if (insertErr) {
        console.error(
          "Failed to insert members for family",
          family.id,
          insertErr,
        );
        continue;
      }

      // Update filled_slots to reflect actual members count (set to total_slots)
      const { error: updErr } = await supabase
        .from("families")
        .update({ filled_slots: family.total_slots })
        .eq("id", family.id);
      if (updErr) {
        console.error(
          "Failed to update filled_slots for family",
          family.id,
          updErr,
        );
      }

      console.log(
        `Filled family ${family.service_name} — added ${inserted.length} members.`,
      );
    } catch (err) {
      console.error("Unexpected error while filling family", family.id, err);
    }
  }

  console.log("Done.");
}

main();
