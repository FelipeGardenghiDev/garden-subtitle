import React from 'react';
import { Sparkles, Sliders } from 'lucide-react';
import { KineticConfig, KineticStyle } from '../types';

interface KineticStyleCustomizerProps {
  kineticConfig: KineticConfig;
  onSelectPreset: (style: KineticStyle) => void;
  onUpdateConfig: (newConfig: Partial<KineticConfig>) => void;
}

export const KineticStyleCustomizer: React.FC<KineticStyleCustomizerProps> = ({
  kineticConfig,
  onSelectPreset,
  onUpdateConfig
}) => {
  const PRESET_CARDS: { id: KineticStyle; title: string; desc: string; sample: string }[] = [
    {
      id: 'hormozi',
      title: 'Alex Hormozi',
      desc: 'Letras pretas bold com preenchimento amarelo forte e animação pop',
      sample: 'CONVERSÃO MÁXIMA'
    },
    {
      id: 'mrbeast',
      title: 'MrBeast Impact',
      desc: 'Borda preta hiper espessa, fonte Titan e punch dinâmico',
      sample: 'INSANO & VIRAL'
    },
    {
      id: 'tiktok-glow',
      title: 'TikTok Neon Glow',
      desc: 'Cores ciano elétricas com sombra difusa para vídeos modernos',
      sample: 'TREND VIRAL'
    },
    {
      id: 'minimal-clean',
      title: 'Minimal Clean',
      desc: 'Estilo sóbrio sem bordas pesadas, elegante e sofisticado',
      sample: 'Design Elegante'
    },
    {
      id: 'ali-abdaal',
      title: 'Ali Abdaal',
      desc: 'Efeito marca-texto (highlighter) e leve rotação inclinada',
      sample: 'Produtividade'
    },
    {
      id: 'karaoke-wave',
      title: 'Karaoke Wave',
      desc: 'Iluminação contínua progressiva das sílabas',
      sample: 'Fluxo Contínuo'
    }
  ];

  return (
    <div className="space-y-5">
      {/* Grade de Presets Visuais */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Presets Cinéticos Virais
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESET_CARDS.map(preset => {
            const isSelected = kineticConfig.style === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/20 border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                      {preset.title}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        ATIVO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mb-2">{preset.desc}</p>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800/80 text-center font-black text-xs text-amber-300">
                  {preset.sample}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controles Finos de Customização */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          Ajustes Manuais de Estilo
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Tamanho da Fonte */}
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Tamanho da Fonte:</span>
              <span className="font-mono text-emerald-400 font-bold">{kineticConfig.fontSize}px</span>
            </div>
            <input
              type="range"
              min={24}
              max={110}
              value={kineticConfig.fontSize}
              onChange={(e) => onUpdateConfig({ fontSize: parseInt(e.target.value) })}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Posição Vertical Y */}
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Posição Vertical:</span>
              <span className="font-mono text-emerald-400 font-bold">{kineticConfig.positionY}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={95}
              value={kineticConfig.positionY}
              onChange={(e) => onUpdateConfig({ positionY: parseInt(e.target.value) })}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Intensidade de Zoom (Pop Scale) */}
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Impacto do Zoom (Pop):</span>
              <span className="font-mono text-emerald-400 font-bold">{kineticConfig.animationScale}x</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={1.6}
              step={0.05}
              value={kineticConfig.animationScale}
              onChange={(e) => onUpdateConfig({ animationScale: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Rotação Inclinada */}
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Rotação Inclinada:</span>
              <span className="font-mono text-emerald-400 font-bold">{kineticConfig.rotation || 0}&deg;</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              step={1}
              value={kineticConfig.rotation || 0}
              onChange={(e) => onUpdateConfig({ rotation: parseInt(e.target.value) })}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Cor de Destaque */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Cor do Destaque:</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={kineticConfig.highlightColor}
                onChange={(e) => onUpdateConfig({ highlightColor: e.target.value })}
                className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-300 font-bold uppercase">
                {kineticConfig.highlightColor}
              </span>
            </div>
          </div>

          {/* Palavras por Linha */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Máximo de Palavras por Bloco:</label>
            <select
              value={kineticConfig.maxWordsPerLine || 4}
              onChange={(e) => onUpdateConfig({ maxWordsPerLine: parseInt(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Palavra (Ultra Rápido / TikTok)</option>
              <option value={2}>2 Palavras</option>
              <option value={3}>3 Palavras</option>
              <option value={4}>4 Palavras (Padrão Hormozi)</option>
              <option value={6}>6 Palavras</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
