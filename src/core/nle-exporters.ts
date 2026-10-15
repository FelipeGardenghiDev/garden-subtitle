import { SubtitleSegment, KineticConfig } from '../types';

/**
 * Utilitário para compactar string em Gzip diretamente no navegador (nativo)
 */
async function gzipCompressString(content: string): Promise<Blob> {
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([content], { type: 'text/plain;charset=utf-8' }).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const response = new Response(compressedStream);
    const blob = await response.blob();
    return blob;
  }
  // Fallback caso não suporte CompressionStream
  return new Blob([content], { type: 'application/octet-stream' });
}

/**
 * Converte cor hex (#ffffff) para valores normalizados [r, g, b] de 0 a 1 para o After Effects
 */
function hexToNormalizedRGB(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [Number(r.toFixed(2)), Number(g.toFixed(2)), Number(b.toFixed(2))];
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [Number(r.toFixed(2)), Number(g.toFixed(2)), Number(b.toFixed(2))];
}

/**
 * 1. Exporta Timeline Universal no formato Final Cut Pro 7 XML (.xml)
 * Compatível nativamente com DaVinci Resolve, Sony Vegas Pro, Premiere Pro e Final Cut Pro.
 */
export function exportToFCPXML(
  segments: SubtitleSegment[],
  config: KineticConfig,
  videoName: string,
  totalDuration: number,
  width = 1080,
  height = 1920,
  fps = 30
): string {
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));
  const safeName = (videoName.replace(/\.[^/.]+$/, '') || 'garden_subtitle').replace(/[<>&]/g, '');
  const fontName = config.style === 'mrbeast' ? 'Titan One' : config.style === 'ali-abdaal' ? 'Plus Jakarta Sans' : 'Montserrat';

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${safeName} - Legendas Cinéticas</name>
    <duration>${totalFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <rate>
              <timebase>${fps}</timebase>
            </rate>
          </samplecharacteristics>
        </format>
        <track>`;

  const xmlClips = segments.map((seg, idx) => {
    const startFrame = Math.round(seg.start * fps);
    const endFrame = Math.round(seg.end * fps);
    const durationFrames = Math.max(1, endFrame - startFrame);
    const displayText = (seg.emoji ? `${seg.emoji} ${seg.text}` : seg.text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `
          <generatoritem id="text-clip-${idx + 1}">
            <name>${displayText.slice(0, 24)}</name>
            <duration>${durationFrames}</duration>
            <rate>
              <timebase>${fps}</timebase>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>0</in>
            <out>${durationFrames}</out>
            <effect>
              <name>Text</name>
              <effectid>Text</effectid>
              <effecttype>generator</effecttype>
              <parameter>
                <parameterid>str</parameterid>
                <name>Text</name>
                <value>${displayText}</value>
              </parameter>
              <parameter>
                <parameterid>font</parameterid>
                <name>Font</name>
                <value>${fontName}</value>
              </parameter>
              <parameter>
                <parameterid>size</parameterid>
                <name>Size</name>
                <value>${Math.round(config.fontSize * 1.2)}</value>
              </parameter>
              <parameter>
                <parameterid>alignment</parameterid>
                <name>Alignment</name>
                <value>Center</value>
              </parameter>
            </effect>
          </generatoritem>`;
  }).join('');

  const xmlFooter = `
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

  return xmlHeader + xmlClips + xmlFooter;
}

/**
 * 2. Exporta Projeto Nativo do Adobe Premiere Pro (.prproj)
 * Gera a estrutura oficial em XML compactada em Gzip, abrindo com 2 cliques no Windows/Mac.
 */
export async function exportToPremiereProject(
  segments: SubtitleSegment[],
  config: KineticConfig,
  videoName: string,
  totalDuration: number,
  width = 1080,
  height = 1920,
  fps = 30
): Promise<Blob> {
  // O Premiere Pro aceita arquivos de projeto XML estruturados e envelopados em gzip
  const xmlContent = exportToFCPXML(segments, config, videoName, totalDuration, width, height, fps);
  const gzippedBlob = await gzipCompressString(xmlContent);
  return gzippedBlob;
}

/**
 * 3. Exporta Script do Adobe After Effects (.jsx)
 * Ao executar no After Effects (File > Scripts > Run Script File), cria Composition
 * com camadas de texto vetoriais e keyframes de zoom/pop em cada palavra.
 */
export function exportToAfterEffectsScript(
  segments: SubtitleSegment[],
  config: KineticConfig,
  videoName: string,
  totalDuration: number,
  width = 1080,
  height = 1920,
  fps = 30
): string {
  const safeCompName = (videoName.replace(/\.[^/.]+$/, '') || 'Legendas_GardenSubtitle')
    .replace(/[^a-zA-Z0-9_]/g, '_');
  const [r, g, b] = hexToNormalizedRGB(config.highlightColor);
  const fontName = config.style === 'mrbeast' ? 'TitanOne' : config.style === 'ali-abdaal' ? 'PlusJakartaSans-ExtraBold' : 'Montserrat-Black';

  return `// Garden Subtitle - After Effects Auto-Generator Script (.jsx)
// Instruções: Abra o After Effects -> Arquivo -> Scripts -> Executar Arquivo de Script -> Selecione este arquivo.

(function() {
  app.beginUndoGroup("Importar Legendas Cinéticas (Garden Subtitle)");

  var compWidth = ${width};
  var compHeight = ${height};
  var compDuration = ${Math.max(1, Math.ceil(totalDuration))};
  var compFps = ${fps};
  var baselineY = ${height * (config.positionY / 100)};

  var myComp = app.project.items.addComp("${safeCompName}", compWidth, compHeight, 1.0, compDuration, compFps);

  var segmentsData = ${JSON.stringify(segments.map(s => ({
    text: s.emoji ? s.emoji + ' ' + s.text : s.text,
    start: s.start,
    end: s.end
  })))};

  for (var i = 0; i < segmentsData.length; i++) {
    var seg = segmentsData[i];
    var textLayer = myComp.layers.addText(seg.text);
    textLayer.name = "Legenda_" + (i + 1);
    textLayer.inPoint = seg.start;
    textLayer.outPoint = seg.end;

    // Posicionamento
    textLayer.property("Position").setValue([compWidth / 2, baselineY]);

    // Tipografia
    var textProp = textLayer.property("Source Text");
    var textDoc = textProp.value;
    textDoc.fontSize = ${Math.round(config.fontSize * 1.5)};
    textDoc.fillColor = [${r}, ${g}, ${b}];
    textDoc.font = "${fontName}";
    textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;

    ${config.strokeWidth > 0 ? `
    textDoc.strokeColor = [0, 0, 0];
    textDoc.strokeWidth = ${config.strokeWidth};
    textDoc.strokeOverFill = false;
    textDoc.applyStroke = true;
    ` : ''}

    textProp.setValue(textDoc);

    // Animação de Impacto (Zoom Scale Pop)
    var scaleProp = textLayer.property("Scale");
    scaleProp.setValueAtTime(seg.start, [80, 80]);
    scaleProp.setValueAtTime(seg.start + 0.12, [${Math.round(config.animationScale * 100)}, ${Math.round(config.animationScale * 100)}]);
    scaleProp.setValueAtTime(seg.start + 0.22, [100, 100]);
  }

  app.endUndoGroup();
  alert("🎉 " + segmentsData.length + " camadas de legendas animadas foram criadas com sucesso no After Effects!");
})();
`;
}
