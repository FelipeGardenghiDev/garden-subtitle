import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

/**
 * Extensões de vídeo e contêineres que navegadores geralmente não decodificam nativamente
 */
export const NON_NATIVE_VIDEO_EXTENSIONS = [
  'mkv',
  'avi',
  'wmv',
  'flv',
  'mts',
  'm2ts',
  'vob',
  '3gp',
  'rmvb',
  'ts'
];

/**
 * Verifica se um arquivo possui extensão não-nativa para o navegador
 */
export function isNonNativeFormat(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return NON_NATIVE_VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Inicializa ou retorna a instância singleton do FFmpeg Wasm
 */
export async function getFFmpeg(
  onLog?: (msg: string) => void,
  onProgress?: (progress: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      // progress varia de 0 a 1
      onProgress(Math.min(100, Math.round(progress * 100)));
    });
  }

  // Carrega a versão single-thread estável do FFmpeg Wasm que roda em qualquer navegador
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  isLoaded = true;
  return ffmpegInstance;
}

export interface TranscodeResult {
  blob: Blob;
  url: string;
  fileName: string;
  isRemuxed: boolean;
}

/**
 * Converte ou faz remuxing de um arquivo de vídeo não-nativo (.mkv, .avi, etc.) para MP4/WebM compatível
 */
export async function transcodeOrRemuxVideo(
  file: File,
  onStatusUpdate: (percent: number, message: string) => void
): Promise<TranscodeResult> {
  onStatusUpdate(5, 'Carregando motor FFmpeg WebAssembly...');
  const ffmpeg = await getFFmpeg(
    (msg) => console.log('[FFmpeg Log]', msg),
    (pct) => onStatusUpdate(pct, `Processando vídeo no navegador: ${pct}%`)
  );

  const fileExt = file.name.toLowerCase().split('.').pop() || 'tmp';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const inputFileName = `input_${Date.now()}.${fileExt}`;
  const outputFileName = `output_${Date.now()}.mp4`;

  try {
    onStatusUpdate(20, 'Lendo arquivo de vídeo na memória local...');
    const fileData = await fetchFile(file);
    await ffmpeg.writeFile(inputFileName, fileData);

    // Tentativa 1: Remuxing rápido (cópia direta de trilhas sem perda de qualidade)
    onStatusUpdate(35, 'Tentando remuxing instantâneo para MP4...');
    let remuxSuccess = false;
    try {
      const exitCode = await ffmpeg.exec(['-i', inputFileName, '-c', 'copy', outputFileName]);
      if (exitCode === 0) {
        remuxSuccess = true;
      }
    } catch {
      remuxSuccess = false;
    }

    // Tentativa 2: Se o remuxing falhar (codec incompatível como DivX/XviD), faz transcode H.264 ultrafast
    if (!remuxSuccess) {
      onStatusUpdate(50, 'Transcodificando vídeo para H.264/AAC via CPU...');
      const transcodeCode = await ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputFileName
      ]);

      if (transcodeCode !== 0) {
        throw new Error('Falha no processamento FFmpeg: código ' + transcodeCode);
      }
    }

    onStatusUpdate(90, 'Finalizando contêiner MP4...');
    const outputData = await ffmpeg.readFile(outputFileName);
    const uint8 = outputData instanceof Uint8Array ? outputData : new Uint8Array(outputData as any);
    const finalBlob = new Blob([uint8.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(finalBlob);

    // Limpar arquivos temporários na memória virtual Wasm
    await ffmpeg.deleteFile(inputFileName).catch(() => {});
    await ffmpeg.deleteFile(outputFileName).catch(() => {});

    onStatusUpdate(100, 'Vídeo convertido com sucesso!');

    return {
      blob: finalBlob,
      url,
      fileName: `${baseName}.mp4`,
      isRemuxed: remuxSuccess
    };
  } catch (err: any) {
    // Tenta limpar arquivos em caso de falha
    await ffmpeg.deleteFile(inputFileName).catch(() => {});
    await ffmpeg.deleteFile(outputFileName).catch(() => {});
    throw err;
  }
}

/**
 * Converte um arquivo WebM gravado pelo navegador para MP4 universal
 */
export async function convertWebMToMP4(
  webmBlob: Blob,
  outputName: string,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(
    (msg) => console.log('[FFmpeg MP4 Export]', msg),
    onProgress
  );

  const inputName = `record_${Date.now()}.webm`;
  const outputFileName = `record_${Date.now()}.mp4`;

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));
    
    // Remux direto se os codecs forem compatíveis, senão transcode leve
    const exitCode = await ffmpeg.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-c:a', 'aac',
      outputFileName
    ]);

    if (exitCode !== 0) {
      throw new Error('Falha ao converter WebM para MP4');
    }

    const data = await ffmpeg.readFile(outputFileName);
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data as any);
    const mp4Blob = new Blob([uint8.buffer], { type: 'video/mp4' });

    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputFileName).catch(() => {});

    return mp4Blob;
  } catch (err) {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputFileName).catch(() => {});
    throw err;
  }
}
