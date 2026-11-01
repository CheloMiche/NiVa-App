import imageCompression from 'browser-image-compression';

export async function compressAndUploadImage(file, folder = 'piezas') {
  const options = {
    maxSizeMB: 0.2, // Máximo 200 KB por imagen para cuidar el almacenamiento gratuito
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp'
  };

  try {
    const compressedFile = await imageCompression(file, options);
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;

    const { data, error } = await supabase.storage
      .from('piezas-imagenes')
      .upload(fileName, compressedFile, {
        contentType: 'image/webp',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('piezas-imagenes')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error comprimiendo/subiendo imagen:', error);
    throw error;
  }
}