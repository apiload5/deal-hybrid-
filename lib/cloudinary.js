import { v2 as cloudinary } from 'cloudinary';

let configured = false;
function configCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    configured = true;
  }
}

export async function uploadImage(file, folder = 'deal-pk') {
  configCloudinary();
  // baqi code same
}
