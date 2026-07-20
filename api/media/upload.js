import { supabase, verifyToken } from '../../lib/supabase.js';
import { uploadImage, uploadMultipleImages, deleteImage } from '../../lib/cloudinary.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    return handleUpload(req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleUpload(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    const user = await verifyToken(token);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    const { files, propertyId, projectId, agencyId, builderId } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No files provided' 
      });
    }

    // Verify ownership
    if (propertyId) {
      const { data: property } = await supabase
        .from('properties')
        .select('owner_id')
        .eq('id', propertyId)
        .single();

      if (property && property.owner_id !== user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden' 
        });
      }
    }

    const folder = propertyId ? 'deal-pk/properties' : 'deal-pk/general';
    const uploadedImages = await uploadMultipleImages(files, folder);

    const mediaRecords = uploadedImages.map(img => ({
      property_id: propertyId || null,
      project_id: projectId || null,
      agency_id: agencyId || null,
      builder_id: builderId || null,
      url: img.url,
      public_id: img.public_id,
      format: img.format,
      size: img.size,
      width: img.width,
      height: img.height,
    }));

    const { data, error } = await supabase
      .from('media')
      .insert(mediaRecords)
      .select();

    if (error) {
      // Cleanup uploaded images
      for (const img of uploadedImages) {
        await deleteImage(img.public_id);
      }
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(201).json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleDelete(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    const user = await verifyToken(token);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Media ID is required' 
      });
    }

    // Check ownership
    const { data: media, error: checkError } = await supabase
      .from('media')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !media) {
      return res.status(404).json({ 
        success: false, 
        error: 'Media not found' 
      });
    }

    // Delete from Cloudinary
    if (media.public_id) {
      await deleteImage(media.public_id);
    }

    const { error } = await supabase
      .from('media')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error) {
    console.error('DELETE media error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
