import { supabase } from "./supabaseClient";

const MAX_RAW_BYTES = 8 * 1024 * 1024; // reject outright before decoding a huge file
const MAX_UPLOAD_BYTES = 400 * 1024; // target ceiling after compression

function compressImage(file, { maxDimension, quality }) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Unable to process that image."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read that image."));
    };
    img.src = objectUrl;
  });
}

// Resizes to a max 512px edge and re-encodes as JPEG client-side, so a
// multi-MB phone photo becomes a few tens of KB before it ever reaches
// Supabase Storage — the free tier's 1GB cap goes a long way this way.
// Falls back to a smaller/lower-quality pass once if still too big.
export async function uploadServiceLogo(file, userId) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new Error("That image is too large (max 8MB).");
  }

  let blob = await compressImage(file, { maxDimension: 512, quality: 0.82 });
  if (blob.size > MAX_UPLOAD_BYTES) {
    blob = await compressImage(file, { maxDimension: 384, quality: 0.6 });
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("Unable to compress that image enough — try a simpler photo.");
  }

  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("service-logos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });

  if (error) {
    throw new Error(error.message || "Upload failed. Please try again.");
  }

  const { data } = supabase.storage.from("service-logos").getPublicUrl(path);
  return data.publicUrl;
}
