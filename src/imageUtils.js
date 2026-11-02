import imageCompression from 'browser-image-compression';
import { supabase } from './supabaseClient';

export const compressAndUploadImage = async (file) => {
  if (!file) return null;

  try {
    // 1. Opciones de compresión ligera para PWA
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/webp'
    };

    const compressedFile = await imageCompression(file, options);

    // 2. Generar nombre único para la imagen
    const fileExt = 'webp';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    // 3. Subida al bucket 'piezas-imagenes'
    const { data, error } = await supabase.storage
      .from('piezas-imagenes')
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error al subir a Supabase Storage:', error.message);
      throw error;
    }

    // 4. Obtener la URL pública final
    const { data: publicUrlData } = supabase.storage
      .from('piezas-imagenes')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;

  } catch (error) {
    console.error('Fallo en compressAndUploadImage:', error);
    throw error;
  }
};