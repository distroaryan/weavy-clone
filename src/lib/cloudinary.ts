import { env } from "env";

/**
 * Utility function to load an image and get its natural dimensions.
 * 
 * @param url - The URL of the image to load.
 * @returns A promise that resolves with the image width and height.
 */
export async function getImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Set crossOrigin if needed for CORS
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

/**
 * Generates a new Cloudinary URL derived from the original URL by applying a crop transformation.
 * 
 * @param imageUrl - The original Cloudinary image URL.
 * @param xPercent - The x-coordinate of the top-left corner of the crop (as a percentage of the image width).
 * @param yPercent - The y-coordinate of the top-left corner of the crop (as a percentage of the image height).
 * @param widthPercent - The width of the crop (as a percentage of the image width).
 * @param heightPercent - The height of the crop (as a percentage of the image height).
 * @returns A promise that resolves to the new Cloudinary URL.
 * @throws Error if the URL is not a valid Cloudinary URL or has an invalid format.
 */
export async function cropCloudinaryImage(
  imageUrl: string,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number,
): Promise<string> {
  // Check if it's a valid Cloudinary URL
  if (!imageUrl.includes("cloudinary.com")) {
    throw new Error("Invalid Cloudinary URL");
  }

  // Get image dimensions
  const { width: imgWidth, height: imgHeight } =
    await getImageDimensions(imageUrl);

  // Calculate actual pixel values from percentages
  const x = Math.round((xPercent / 100) * imgWidth);
  const y = Math.round((yPercent / 100) * imgHeight);
  const width = Math.round((widthPercent / 100) * imgWidth);
  const height = Math.round((heightPercent / 100) * imgHeight);

  // Build the crop transformation string
  const cropTransform = `c_crop,x_${x},y_${y},w_${width},h_${height}`;

  // Split at /upload/
  const parts = imageUrl.split("/upload/");

  if (parts.length !== 2) {
    throw new Error("Invalid Cloudinary URL format");
  }

  // Remove any existing transformations from the second part
  const afterUpload = parts[1]?.replace(/^[^/]+\//, "");

  // Reconstruct URL with new transformation
  return `${parts[0]}/upload/${cropTransform}/${afterUpload}`;
}


/**
 * Uploads a file to Cloudinary.
 * 
 * @param file - The file to upload.
 * @param resourceType - The type of resource to upload (defaults to "image"). 
 *                       Can be "image", "video", or "raw".
 * @returns A promise that resolves to the secure URL of the uploaded resource.
 * @throws Error if the upload fails.
 */
export async function uploadToCloudinary(
  file: File,
  resourceType: "image" | "video" | "raw" = "image",
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

  try {
    const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Upload failed");
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

/**
 * Extracts a frame from a Cloudinary video URL at a specific timestamp.
 * 
 * @param videoUrl - The Cloudinary video URL.
 * @param timestamp - The timestamp in seconds to extract the frame at.
 * @returns The URL of the extracted frame (image).
 * @throws Error if the URL is invalid.
 */
export function extractVideoFrame(videoUrl: string, timestamp: number): string {
  if (!videoUrl.includes("/upload/")) {
    throw new Error("Invalid Cloudinary Video URL");
  }

  // Inject `so_<timestamp>` (start offset) after `/upload/`
  // Change extension to .jpg (forcing image format)

  const parts = videoUrl.split("/upload/");
  const baseUrl = parts[0] + "/upload/";
  const rest = parts[1];

  if (!rest) {
    throw new Error("Invalid Cloudinary Video URL Format");
  }

  const transformation = `so_${timestamp},f_jpg,fl_attachment:false`;

  // Remove extension from valid URL:
  const lastDotIndex = rest.lastIndexOf(".");
  const restNoExt = lastDotIndex !== -1 ? rest.substring(0, lastDotIndex) : rest;

  return `${baseUrl}${transformation}/${restNoExt}.jpg`;
}
