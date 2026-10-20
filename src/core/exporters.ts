import { SubtitleSegment, KineticConfig, GardenCutProjectImport } from '../types';
import { renderKineticSubtitleOnCanvas } from './canvas-renderer';

/**
 * Converte segundos para o formato de tempo SRT: 00:00:01,234
 */
function formatSRTTime(seconds: number): string {
  const pad = (num: number, size = 2) => String(Math.floor(num)).padStart(size, '0');
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Converte segundos para o formato WebVTT: 00:00:01.234
 */
function formatVTTTime(seconds: number): string {
  return formatSRTTime(seconds).replace(',', '.');
}

/**
 * Exporta para arquivo .SRT (SubRip)
 */
export function exportToSRT(segments: SubtitleSegment[]): string {
  return segments.map((seg, idx) => {
    const textWithEmoji = seg.emoji ? `${seg.emoji} ${seg.text}` : seg.text;
    return `${idx + 1}\n${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n${textWithEmoji}\n`;
  }).join('\n');
}

/**
 * Exporta para arquivo WebVTT (.vtt)
 */
export function exportToVTT(segments: SubtitleSegment[]): string {
  const header = 'WEBVTT - Garden Subtitle Export\n\n';
  const body = segments.map((seg, idx) => {
    const textWithEmoji = seg.emoji ? `${seg.emoji} ${seg.text}` : seg.text;
    return `${idx + 1}\n${formatVTTTime(seg.start)} --> ${formatVTTTime(seg.end)}\n${textWithEmoji}\n`;
  }).join('\n');
  return header + body;
}

/**
 * Exporta pacote nativo .garden-sub para importação direta na timeline do GardenCut
 */
export function exportToGardenCut(
  segments: SubtitleSegment[],
  config: KineticConfig,
  totalDuration: number
): GardenCutProjectImport {
  return {
    version: '1.0.0',
    generator: 'Garden Subtitle',
    exportedAt: new Date().toISOString(),
    totalDuration,
    tracks: [
      {
        id: 'track-text-kinetic',
        name: 'Legendas Cinéticas (Garden Subtitle)',
        type: 'text',
        clips: segments.map((seg, idx) => ({
          id: `clip-text-${idx}_${Date.now()}`,
          trackId: 'track-text-kinetic',
          type: 'text',
          name: seg.text.slice(0, 20),
          start: seg.start,
          duration: Math.max(0.1, seg.end - seg.start),
          content: seg.emoji ? `${seg.emoji} ${seg.text}` : seg.text,
          style: {
            fontFamily: config.style === 'hormozi' ? 'Montserrat' : config.style === 'mrbeast' ? 'Titan One' : 'Plus Jakarta Sans',
            fontSize: config.fontSize,
            color: config.highlightColor,
            strokeColor: config.strokeColor,
            strokeWidth: config.strokeWidth,
            backgroundColor: config.backgroundColor
          }
        }))
      }
    ]
  };
}

/**
 * MODO 1: Exporta vídeo com a legenda "queimada" (Burn-in) 100% no navegador
 */
export function exportVideoWithBurnIn(
  videoElement: HTMLVideoElement,
  segments: SubtitleSegment[],
  config: KineticConfig,
  onProgress: (pct: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const width = videoElement.videoWidth || 720;
      const height = videoElement.videoHeight || 1280;
      const duration = videoElement.duration || 10;

      // Criar canvas de exportação com resolução nativa
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        throw new Error('Falha ao obter contexto 2D do Canvas');
      }

      // Capturar stream de vídeo do canvas a 30 FPS
      const canvasStream = canvas.captureStream(30);

      // Capturar áudio do vídeo original
      let combinedStream = canvasStream;
      try {
        const audioStream = (videoElement as any).captureStream ? (videoElement as any).captureStream() : null;
        if (audioStream) {
          const audioTracks = audioStream.getAudioTracks();
          if (audioTracks.length > 0) {
            canvasStream.addTrack(audioTracks[0]);
          }
        }
      } catch (err) {
        console.warn('Áudio não capturável diretamente pelo captureStream, exportando faixa de vídeo:', err);
      }

      // Identificar suporte de codec no navegador (prioriza MP4 nativo se suportado, senão WebM VP9/VP8)
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4;codecs=avc1';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
      } else {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000 // 6 Mbps alta qualidade
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        resolve(finalBlob);
      };

      recorder.onerror = (err) => {
        reject(err);
      };

      // Preparar vídeo para gravação
      recorder.start(100);
      videoElement.currentTime = 0;
      videoElement.muted = false;

      videoElement.play().catch(reject);

      const processFrame = () => {
        if (videoElement.ended || videoElement.currentTime >= duration) {
          recorder.stop();
          videoElement.pause();
          onProgress(100);
          return;
        }

        // Renderizar frame + legenda
        renderKineticSubtitleOnCanvas(
          ctx,
          videoElement,
          width,
          height,
          videoElement.currentTime,
          segments,
          config
        );

        const progress = Math.min(99, Math.round((videoElement.currentTime / duration) * 100));
        onProgress(progress);

        requestAnimationFrame(processFrame);
      };

      requestAnimationFrame(processFrame);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Converte segundos para o formato de tempo ASS: 0:00:01.23
 */
function formatASSTime(seconds: number): string {
  const pad = (num: number, size = 2) => String(Math.floor(num)).padStart(size, '0');
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${hrs}:${pad(mins)}:${pad(secs)}.${pad(cs)}`;
}

/**
 * Converte cor hexadecimal #RRGGBB para o padrão SubStation Alpha BGR (&H00BBGGRR)
 */
export function hexToASSColor(hex: string | undefined, fallback = '&H00FFFFFF'): string {
  if (!hex || !hex.startsWith('#')) return fallback;
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return fallback;
  const r = clean.slice(0, 2).toUpperCase();
  const g = clean.slice(2, 4).toUpperCase();
  const b = clean.slice(4, 6).toUpperCase();
  return `&H00${b}${g}${r}`;
}

/**
 * Exporta para arquivo Advanced SubStation Alpha (.ass) com estilos avançados e tags cinéticas {\k} por palavra
 */
export function exportToASS(
  segments: SubtitleSegment[],
  config: KineticConfig,
  videoWidth = 1080,
  videoHeight = 1920
): string {
  const fontName = config.style === 'mrbeast' ? 'Titan One' : config.style === 'ali-abdaal' ? 'Plus Jakarta Sans' : 'Montserrat';
  const primaryColor = hexToASSColor(config.highlightColor, '&H0047E0FD');
  const secondaryColor = hexToASSColor(config.textColor, '&H00FFFFFF');
  const outlineColor = hexToASSColor(config.strokeColor, '&H00000000');
  const marginV = Math.max(20, Math.round(videoHeight * ((100 - (config.positionY || 75)) / 100)));

  const header = `[Script Info]
Title: Garden Subtitle Export
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${Math.round(config.fontSize * 1.5)},${primaryColor},${secondaryColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,${config.rotation || 0},1,${config.strokeWidth ?? 4},0,2,20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogues = segments.map(seg => {
    const emojiPrefix = config.enableEmojis && seg.emoji ? `${seg.emoji} ` : '';
    if (seg.words && seg.words.length > 0) {
      const karaokeWords = seg.words.map(w => {
        const durationCs = Math.max(5, Math.round((w.end - w.start) * 100));
        return `{\\k${durationCs}}${w.word}`;
      }).join(' ');
      return `Dialogue: 0,${formatASSTime(seg.start)},${formatASSTime(seg.end)},Default,,0,0,0,,${emojiPrefix}${karaokeWords}`;
    }
    return `Dialogue: 0,${formatASSTime(seg.start)},${formatASSTime(seg.end)},Default,,0,0,0,,${emojiPrefix}${seg.text}`;
  }).join('\n');

  return header + dialogues;
}

/**
 * Exporta vídeo de sobreposição com fundo transparente (Alpha WebM)
 */
export function exportTransparentOverlay(
  segments: SubtitleSegment[],
  config: KineticConfig,
  duration: number,
  width: number = 720,
  height: number = 1280,
  onProgress: (pct: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: true });

      if (!ctx) {
        throw new Error('Falha ao obter contexto Alpha do Canvas');
      }

      const canvasStream = canvas.captureStream(30);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 6000000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        resolve(finalBlob);
      };

      recorder.onerror = (e) => reject(e);

      recorder.start(100);

      const fps = 30;
      const totalFrames = Math.max(1, Math.round(duration * fps));
      let currentFrame = 0;

      const renderInterval = setInterval(() => {
        const t = (currentFrame / fps);

        renderKineticSubtitleOnCanvas(
          ctx,
          null,
          width,
          height,
          t,
          segments,
          config,
          true // transparentBackground = true
        );

        currentFrame++;
        const pct = Math.min(100, Math.round((currentFrame / totalFrames) * 100));
        onProgress(pct);

        if (currentFrame >= totalFrames) {
          clearInterval(renderInterval);
          setTimeout(() => {
            recorder.stop();
          }, 150);
        }
      }, 1000 / fps);

    } catch (err) {
      reject(err);
    }
  });
}


/**
 * Converte segundos para o formato de tempo TTML/SMPTE (00:00:01.234)
 */
function formatTTMLTime(seconds: number): string {
  return formatVTTTime(seconds);
}

/**
 * 4. Exporta para especificação W3C TTML (Timed Text Markup Language)
 * Padrão oficial Netflix, Amazon Prime Video e SMPTE-TT.
 */
export function exportToTTML(
  segments: SubtitleSegment[],
  config: KineticConfig,
  videoName = 'garden_subtitle'
): string {
  const safeTitle = (videoName.replace(/\.[^/.]+$/, '') || 'garden_subtitle').replace(/[<>&]/g, '');
  const font = config.style === 'mrbeast' ? 'Titan One' : config.style === 'ali-abdaal' ? 'Plus Jakarta Sans' : 'Montserrat';
  const color = config.highlightColor || '#FFE81F';

  const bodyElements = segments.map((seg, idx) => {
    const text = (seg.emoji ? `${seg.emoji} ${seg.text}` : seg.text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `      <p xml:id="sub_${idx + 1}" begin="${formatTTMLTime(seg.start)}" end="${formatTTMLTime(seg.end)}" region="bottomRegion" style="style_kinetic">${text}</p>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttp="http://www.w3.org/ns/ttml#parameter"
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    ttp:timeBase="media"
    xml:lang="pt-BR">
  <head>
    <metadata>
      <title>${safeTitle} - Garden Subtitle TTML</title>
    </metadata>
    <styling>
      <style xml:id="style_kinetic"
             tts:fontFamily="${font}, sans-serif"
             tts:fontSize="${Math.round(config.fontSize)}px"
             tts:color="${color}"
             tts:textAlign="center"
             tts:fontWeight="bold" />
    </styling>
    <layout>
      <region xml:id="bottomRegion"
              tts:origin="10% ${config.positionY || 75}%"
              tts:extent="80% 20%"
              tts:displayAlign="after" />
    </layout>
  </head>
  <body>
    <div>
${bodyElements}
    </div>
  </body>
</tt>`;
}

/**
 * Converte segundos para timecode SMPTE no padrão EDL (HH:MM:SS:FF)
 */
export function formatEDLTimecode(seconds: number, fps = 30): string {
  const pad = (n: number, s = 2) => String(Math.floor(n)).padStart(s, '0');
  const safeSeconds = Math.max(0, seconds);
  const hrs = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  const frames = Math.min(fps - 1, Math.floor((safeSeconds % 1) * fps));
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

/**
 * 5. Exporta para formato CMX 3600 EDL (Edit Decision List)
 * Padrão universal para interoperabilidade de cortes e legendas no DaVinci Resolve, Avid e Premiere.
 */
export function exportToEDL(
  segments: SubtitleSegment[],
  videoName = 'garden_subtitle',
  fps = 30
): string {
  const safeTitle = (videoName.replace(/\.[^/.]+$/, '').toUpperCase() || 'GARDEN_SUBTITLE')
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 32);

  const header = `TITLE: ${safeTitle}\nFCM: NON-DROP FRAME\n\n`;

  const eventLines = segments.map((seg, idx) => {
    const eventNum = String(idx + 1).padStart(3, '0');
    const inTc = formatEDLTimecode(seg.start, fps);
    const outTc = formatEDLTimecode(seg.end, fps);
    const textSnippet = (seg.emoji ? `${seg.emoji} ${seg.text}` : seg.text).replace(/\r?\n/g, ' ');

    return `${eventNum}  AX       V     C        ${inTc} ${outTc} ${inTc} ${outTc}\n* FROM CLIP NAME: SUB_${eventNum}\n* COMMENT: ${textSnippet}\n`;
  }).join('\n');

  return header + eventLines;
}
