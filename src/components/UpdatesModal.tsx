import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Announcement } from '../announcements';

interface UpdatesModalProps {
  announcement: Announcement;
  onClose: () => void;
}

export default function UpdatesModal({ announcement, onClose }: UpdatesModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-br from-[#0D2A3D] to-[#135480] px-6 py-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-[#06AA48] rounded-full flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white font-sans">{announcement.title}</h2>
          <p className="text-sm text-blue-100 font-sans mt-1">{announcement.intro}</p>
        </div>

        {/* Lista de novidades */}
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
          <div className="space-y-4">
            {announcement.items.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-[#1A6FA8] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold font-sans">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-sans">{item.title}</h3>
                  <p className="text-sm text-slate-500 font-sans mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#1A6FA8] hover:bg-[#135480] text-white font-bold text-sm rounded-xl transition-colors font-sans"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
