import { Paa } from '@bis-toolkit/paa';
import { Edds } from '@bis-toolkit/edds';

function toBytes(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

export function decodePaa(buffer) {
  const bytes = toBytes(buffer);
  const paa = new Paa();
  paa.read(bytes);
  if (!paa.mipmaps.length) throw new Error('PAA-filen indeholder ingen mipmaps.');
  const mip = paa.mipmaps[0];
  const rgba = paa.getArgb32PixelData(bytes, 0);
  return {
    width: mip.width,
    height: mip.height,
    rgba,
    format: `PAA 0x${Number(paa.type).toString(16).toUpperCase()}`,
    mipmaps: paa.mipmaps.length
  };
}

export function decodeEdds(buffer) {
  const bytes = toBytes(buffer);
  const edds = new Edds();
  edds.read(bytes);
  if (!edds.mipmaps.length) throw new Error('EDDS-filen indeholder ingen mipmaps.');
  const mip = edds.mipmaps[0];
  const rgba = edds.getRgbaPixelData(0);
  return {
    width: mip.width,
    height: mip.height,
    rgba,
    format: edds.formatName || 'EDDS',
    mipmaps: edds.mipmaps.length
  };
}
