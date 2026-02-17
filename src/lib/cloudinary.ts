const CLOUD_NAME = "dhckqwm7i";
const UPLOAD_PRESET = "eexamapp";

export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}

export function getCloudinaryUrl(publicId: string, transforms?: string): string {
  const base = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;
  return transforms ? `${base}/${transforms}/${publicId}` : `${base}/${publicId}`;
}
