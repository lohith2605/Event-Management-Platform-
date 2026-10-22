import { v2 as cloudinary } from 'cloudinary';

let isConfigured = false;

export const getCloudinary = () => {
  if (!isConfigured) {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud_name || !api_key || !api_secret) {
      console.warn('Cloudinary credentials missing in environment variables.');
      return null;
    }

    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true,
    });

    isConfigured = true;
  }

  return cloudinary;
};

export default getCloudinary;
