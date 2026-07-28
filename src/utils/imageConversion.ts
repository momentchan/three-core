/** Decode a base64 string into a Blob of the given MIME type. */
export function base64ToBlob(base64: string, mime = 'image/png'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/** Read a File or Blob as a base64-encoded string (data-URL prefix stripped). */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Encode a Blob as a base64 string (data-URL prefix stripped). */
export async function blobToBase64(blob: Blob): Promise<string> {
  return fileToBase64(new File([blob], 'image.png', { type: blob.type || 'image/png' }));
}
