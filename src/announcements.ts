// Conteúdo do modal de novidades exibido ao logar.
//
// COMO USAR QUANDO TIVER NOVIDADE NOVA:
// 1. Troque o "id" abaixo pra qualquer valor novo (ex: 'update-2026-10-01')
// 2. Atualize "title" e "items" com o que mudou
// 3. Pronto — isso sozinho já faz o modal voltar a aparecer (até 2 vezes)
//    pra cada clínica, mesmo quem já tinha visto a versão anterior.
//
// Não precisa mexer em mais nada além deste arquivo pra publicar uma
// novidade nova.

export interface AnnouncementItem {
  title: string;
  description: string;
}

export interface Announcement {
  id: string;
  title: string;
  intro: string;
  items: AnnouncementItem[];
}

export const CURRENT_ANNOUNCEMENT: Announcement = {
  id: 'update-2026-09-12',
  title: 'Novidades no BotClínica',
  intro: 'Preparamos algumas melhorias pensadas no seu dia a dia. Confira o que mudou:',
  items: [
    {
      title: 'Nova aba de Exames',
      description: 'Agora é possível cadastrar exames com agenda própria, sem depender de um médico específico — ideal para clínicas de diagnóstico, ultrassom ou laboratório.',
    },
    {
      title: 'Nome do atendente nas mensagens',
      description: 'Quando um humano assume uma conversa, o nome dele agora aparece em destaque para o paciente, deixando o atendimento mais pessoal.',
    },
  ],
};
