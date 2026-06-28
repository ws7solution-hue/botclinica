// ── BASE DE CONHECIMENTO MÉDICA ── BotClínica
// Perguntas e respostas por especialidade para o bot de atendimento
// Usado como contexto adicional no system prompt do bot

module.exports = {

  clinica_geral: {
    nome: "Clínica Geral / Medicina Interna",
    descricao: "Médico que avalia a saúde geral, diagnostica e trata doenças comuns, e encaminha para especialistas quando necessário.",
    procedimentos_comuns: [
      "Consulta clínica geral", "Check-up preventivo", "Solicitação de exames laboratoriais",
      "Eletrocardiograma (ECG)", "Aferição de pressão arterial", "Medição de glicemia",
      "Prescrição de medicamentos", "Atestados médicos", "Declaração de comparecimento",
      "Renovação de receitas", "Avaliação pré-operatória", "Acompanhamento de doenças crônicas"
    ],
    perguntas_frequentes: {
      "O que o clínico geral trata?": "O clínico geral trata doenças comuns como gripe, resfriado, infecções, hipertensão, diabetes, colesterol alto, problemas digestivos, entre outros. Também faz check-ups preventivos e encaminha para especialistas quando necessário.",
      "Precisa de encaminhamento para consultar?": "Não necessariamente. O clínico geral pode ser consultado diretamente sem encaminhamento de outro médico.",
      "O médico emite atestado?": "Sim, o clínico geral pode emitir atestados médicos, declarações de comparecimento e afastamento do trabalho.",
      "Fazem check-up completo?": "Sim. O check-up inclui consulta, avaliação dos sinais vitais e solicitação de exames laboratoriais e de imagem conforme a idade e histórico do paciente.",
      "Quanto tempo dura a consulta?": "Em média de 20 a 40 minutos, dependendo da complexidade do caso.",
      "O que devo levar na consulta?": "Documentos pessoais, carteirinha do convênio, exames anteriores, lista de medicamentos que usa e histórico de doenças.",
      "Renovam receitas de medicamentos contínuos?": "Sim, mediante avaliação do paciente e histórico clínico.",
      "Atendem hipertensão e diabetes?": "Sim, o acompanhamento de hipertensão e diabetes é uma das principais atividades do clínico geral.",
    }
  },

  cardiologia: {
    nome: "Cardiologia",
    descricao: "Especialidade médica que cuida do coração e do sistema cardiovascular.",
    procedimentos_comuns: [
      "Eletrocardiograma (ECG)", "Ecocardiograma", "Holter 24h", "MAPA (monitoramento ambulatorial da pressão)",
      "Teste ergométrico (esteira)", "Doppler vascular", "Cintilografia miocárdica",
      "Avaliação pré-operatória cardíaca", "Acompanhamento de marca-passo",
      "Tratamento de arritmias", "Avaliação de insuficiência cardíaca", "Prevenção de infarto"
    ],
    perguntas_frequentes: {
      "O que o cardiologista trata?": "O cardiologista trata doenças do coração como hipertensão, arritmias, insuficiência cardíaca, angina, infarto (pós-evento), colesterol alto e problemas nas válvulas cardíacas.",
      "O médico faz eletrocardiograma (ECG)?": "Sim, o eletrocardiograma é realizado na própria consulta e o resultado é analisado na hora.",
      "Fazem ecocardiograma?": "Isso varia por clínica — confirme com nossa recepção se o exame é realizado no local ou se há encaminhamento.",
      "Posso consultar sem ter sintomas cardíacos?": "Sim! A consulta preventiva é muito recomendada, especialmente para quem tem histórico familiar de doenças cardíacas, diabetes ou pressão alta.",
      "O que é o Holter?": "O Holter é um monitor cardíaco que o paciente usa por 24 horas para registrar o ritmo do coração durante as atividades do dia a dia.",
      "Fazem teste ergométrico (esteira)?": "Isso varia por clínica — confirme com nossa equipe.",
      "Precisa estar em jejum para a consulta?": "Não é necessário jejum para a consulta. Para exames de sangue específicos, pode ser solicitado.",
      "O que devo levar?": "Exames anteriores (ECG, ecocardiograma, exames de sangue), lista de medicamentos que usa e carteirinha do convênio.",
      "O cardiologista faz cirurgia?": "O cardiologista clínico não realiza cirurgias. Cirurgias cardíacas são feitas por cirurgiões cardiovasculares.",
      "Quanto tempo dura a consulta?": "Primeira consulta em média 30 a 45 minutos. Retornos costumam ser mais curtos.",
    }
  },

  dermatologia: {
    nome: "Dermatologia",
    descricao: "Especialidade que trata doenças da pele, cabelo e unhas.",
    procedimentos_comuns: [
      "Consulta dermatológica", "Dermatoscopia (análise de pintas/lesões)", "Biopsia de pele",
      "Remoção de lesões benignas", "Remoção de verrugas", "Crioterapia",
      "Peeling químico", "Toxina botulínica (botox)", "Preenchimento facial",
      "Laser fracionado", "Tratamento de acne", "Tratamento de manchas",
      "Tratamento de queda de cabelo (alopecia)", "Tratamento de psoríase e eczema",
      "Mapeamento corporal de nevos (pintas)"
    ],
    perguntas_frequentes: {
      "O dermatologista trata acne?": "Sim, o tratamento de acne é uma das principais consultas dermatológicas, incluindo avaliação do tipo de acne e prescrição do tratamento adequado.",
      "Fazem remoção de pintas?": "Sim, pintas suspeitas ou inestéticas podem ser avaliadas e removidas. Antes da remoção é feita a dermatoscopia para análise.",
      "O que é dermatoscopia?": "É um exame que usa um equipamento de ampliação para analisar lesões de pele com mais detalhe, muito usado para detectar melanoma precocemente.",
      "Atendem queda de cabelo?": "Sim, a dermatologia trata alopecia (queda de cabelo) em homens e mulheres, incluindo alopecia androgenética e outras causas.",
      "Fazem procedimentos estéticos como botox?": "Isso varia por clínica — confirme com nossa equipe quais procedimentos estéticos são realizados.",
      "O médico faz peeling?": "Isso varia por clínica — confirme com nossa equipe.",
      "Tratam psoríase?": "Sim, a psoríase é tratada pelo dermatologista com medicamentos tópicos, sistêmicos ou biológicos dependendo da gravidade.",
      "O que devo levar na consulta?": "Exames anteriores relacionados à pele, lista de medicamentos em uso e, se possível, fotos de lesões que aparecem e somem.",
      "Quanto tempo dura a consulta?": "Em média 20 a 30 minutos. Procedimentos podem levar mais tempo.",
      "Precisa de preparo especial?": "Não use maquiagem nem esmalte nas unhas se for consultar sobre essas áreas. Evite exposição solar intensa antes de procedimentos a laser.",
      "Tratam manchas na pele?": "Sim, manchas causadas por sol, melasma, acne ou outras causas são tratadas com cremes, peelings ou laser.",
    }
  },

  ortopedia: {
    nome: "Ortopedia e Traumatologia",
    descricao: "Especialidade que trata problemas nos ossos, articulações, músculos, tendões e ligamentos.",
    procedimentos_comuns: [
      "Consulta ortopédica", "Avaliação de fraturas", "Infiltração articular",
      "Imobilização com gesso ou órtese", "Solicitação de raio-X e ressonância magnética",
      "Artroscopia do joelho e ombro", "Cirurgia de hérnia de disco",
      "Cirurgia de menisco", "Prótese de quadril e joelho",
      "Tratamento de tendinite e bursite", "Cirurgia de coluna", "Avaliação de escoliose"
    ],
    perguntas_frequentes: {
      "O ortopedista trata dor nas costas?": "Sim, dores na coluna lombar, cervical e torácica são tratadas pelo ortopedista, incluindo hérnia de disco e escoliose.",
      "O médico faz infiltração?": "Isso varia por clínica — confirme com nossa equipe. A infiltração é usada para tratar dores articulares com anti-inflamatórios ou ácido hialurônico.",
      "Tratam tendinite?": "Sim, tendinite nos ombros, joelhos, cotovelos e outros locais são tratadas com fisioterapia, medicamentos e, em alguns casos, infiltração.",
      "O médico opera?": "Isso varia por clínica — confirme com nossa equipe quais cirurgias são realizadas.",
      "O que é artroscopia?": "É uma cirurgia minimamente invasiva feita com câmera para tratar problemas em articulações como joelho, ombro e tornozelo.",
      "Atendem casos de urgência por fratura?": "Confirme com nossa equipe se atendemos urgências ortopédicas.",
      "O que devo levar na consulta?": "Raio-X, ressonância ou tomografia anteriores, exames de sangue e relatórios de outros médicos relacionados ao problema.",
      "Quanto tempo dura a consulta?": "Primeira consulta em média 30 a 40 minutos.",
      "Tratam lesões esportivas?": "Sim, lesões em atletas e praticantes de esportes são uma especialidade da ortopedia.",
      "Atendem crianças?": "Sim, o ortopedista pode atender crianças, especialmente para avaliação do desenvolvimento ósseo, escoliose e pé chato.",
    }
  },

  ginecologia: {
    nome: "Ginecologia e Obstetrícia",
    descricao: "Especialidade que cuida da saúde da mulher, incluindo saúde reprodutiva e acompanhamento da gravidez.",
    procedimentos_comuns: [
      "Consulta ginecológica", "Exame Papanicolau (preventivo)", "Colposcopia",
      "Ultrassom transvaginal e obstétrico", "Inserção e remoção de DIU",
      "Prescrição de anticoncepcionais", "Acompanhamento pré-natal",
      "Tratamento de infecções vaginais", "Tratamento de endometriose",
      "Tratamento de miomas", "Avaliação de menopausa", "Histeroscopia",
      "Cirurgia ginecológica (laparoscopia)", "Biópsia de colo uterino"
    ],
    perguntas_frequentes: {
      "Fazem Papanicolau (preventivo)?": "Sim, o exame preventivo é realizado na consulta. É recomendado anualmente para mulheres a partir dos 25 anos.",
      "Fazem ultrassom na consulta?": "Isso varia por clínica — confirme com nossa equipe se o ultrassom é realizado no local.",
      "Atendem pré-natal?": "Isso varia por clínica — confirme com nossa equipe se realizamos acompanhamento de gravidez.",
      "Colocam DIU?": "Isso varia por clínica — confirme com nossa equipe.",
      "Tratam endometriose?": "Sim, o diagnóstico e tratamento de endometriose são realizados pelo ginecologista.",
      "Atendem adolescentes?": "Sim, a ginecologia atende adolescentes para orientação sobre saúde reprodutiva.",
      "O que devo levar na consulta?": "Exames anteriores, data da última menstruação, lista de medicamentos em uso e carteirinha do convênio.",
      "Quanto tempo dura a consulta?": "Primeira consulta em média 30 a 40 minutos.",
      "Precisa estar menstruada para o preventivo?": "Não — é melhor que não esteja. O exame deve ser feito fora do período menstrual.",
      "Atendem menopausa e reposição hormonal?": "Sim, avaliação e tratamento dos sintomas da menopausa, incluindo terapia hormonal, são realizados.",
      "O médico faz cirurgias ginecológicas?": "Isso varia por clínica — confirme com nossa equipe.",
    }
  },

  oftalmologia: {
    nome: "Oftalmologia",
    descricao: "Especialidade que trata doenças dos olhos e da visão.",
    procedimentos_comuns: [
      "Consulta oftalmológica", "Mapeamento de retina", "Medição de pressão ocular (tonometria)",
      "Exame de fundo de olho", "Refração (grau dos óculos)", "Biometria ocular",
      "Cirurgia de catarata", "Cirurgia refrativa (miopia, astigmatismo)",
      "Tratamento de glaucoma", "Injeção intravítrea", "Tratamento de estrabismo",
      "Tratamento de pterígio", "Cirurgia de pálpebra"
    ],
    perguntas_frequentes: {
      "O médico faz cirurgia de catarata?": "Isso varia por clínica — confirme com nossa equipe se realizamos cirurgia de catarata.",
      "Fazem cirurgia para tirar óculos (miopia)?": "Isso varia por clínica — confirme com nossa equipe sobre cirurgia refrativa.",
      "Fazem mapeamento de retina?": "Isso varia por clínica — confirme com nossa equipe.",
      "O que é tonometria?": "É o exame que mede a pressão dentro do olho, usado para detectar e acompanhar o glaucoma.",
      "Atendem crianças?": "Sim, avaliação da visão em crianças é muito importante para detectar problemas precocemente.",
      "Tratam glaucoma?": "Sim, o diagnóstico e tratamento de glaucoma com colírios, laser ou cirurgia são realizados.",
      "O que devo levar na consulta?": "Óculos ou lentes de contato atuais, exames anteriores e carteirinha do convênio.",
      "Quanto tempo dura a consulta?": "Em média 30 a 60 minutos. Alguns exames dilatam a pupila e podem estender o tempo.",
      "Posso dirigir após a consulta?": "Se a pupila for dilatada durante o exame, não é recomendado dirigir por algumas horas. Venha acompanhado se possível.",
      "Atendem urgências como olho vermelho e dor?": "Confirme com nossa equipe se atendemos urgências oftalmológicas.",
      "Fazem exame de grau para óculos?": "Sim, a refração (medição do grau) é realizada na consulta.",
    }
  },

  pediatria: {
    nome: "Pediatria",
    descricao: "Especialidade médica dedicada à saúde de crianças e adolescentes.",
    procedimentos_comuns: [
      "Consulta pediátrica", "Acompanhamento do desenvolvimento infantil",
      "Vacinação e carteira de vacinação", "Avaliação nutricional",
      "Tratamento de infecções respiratórias", "Tratamento de otite",
      "Avaliação de alergias infantis", "Tratamento de asma em crianças",
      "Avaliação do crescimento", "Atestados escolares", "Declaração de saúde"
    ],
    perguntas_frequentes: {
      "Até que idade o pediatra atende?": "Em geral até os 18 anos, podendo variar por médico. Alguns atendem até os 21 anos.",
      "O pediatra acompanha o desenvolvimento da criança?": "Sim, o acompanhamento do desenvolvimento motor, cognitivo e emocional é uma das principais funções do pediatra.",
      "Atendem recém-nascidos?": "Sim, desde o nascimento.",
      "O médico orienta sobre vacinação?": "Sim, o pediatra orienta sobre o calendário de vacinas e pode emitir declarações sobre vacinação.",
      "Atendem crianças com febre?": "Confirme com nossa equipe se atendemos urgências pediátricas.",
      "O que devo levar na consulta?": "Carteira de vacinação, exames anteriores, carteirinha do convênio e informações sobre desenvolvimento da criança.",
      "Quanto tempo dura a consulta?": "Em média 20 a 40 minutos.",
      "O pediatra trata alergia?": "Sim, alergias comuns em crianças como rinite, asma e alergia alimentar são tratadas pelo pediatra.",
      "Emitem atestado escolar?": "Sim, atestados e declarações escolares são emitidos pelo pediatra.",
      "Atendem adolescentes com problemas emocionais?": "O pediatra pode fazer a avaliação inicial e encaminhar para psicólogo ou psiquiatra infantil se necessário.",
    }
  },

  urologia: {
    nome: "Urologia",
    descricao: "Especialidade que trata doenças do sistema urinário e reprodutor masculino.",
    procedimentos_comuns: [
      "Consulta urológica", "PSA (antígeno prostático)", "Biópsia de próstata",
      "Ultrassom de próstata", "Urofluxometria", "Cistoscopia",
      "Tratamento de cálculo renal (pedra nos rins)", "Litotripsia",
      "Tratamento de infecção urinária", "Tratamento de disfunção erétil",
      "Vasectomia", "Cirurgia de próstata", "Tratamento de incontinência urinária",
      "Tratamento de varicocele"
    ],
    perguntas_frequentes: {
      "O urologista atende mulheres?": "Sim, o urologista trata doenças do sistema urinário em homens e mulheres, como infecções urinárias e pedras nos rins.",
      "Fazem exame de PSA?": "Sim, o PSA é um exame de sangue solicitado pelo urologista para avaliar a saúde da próstata.",
      "O médico faz vasectomia?": "Isso varia por clínica — confirme com nossa equipe.",
      "Tratam pedra nos rins?": "Sim, o tratamento de cálculos renais é uma das principais especialidades da urologia.",
      "O que é litotripsia?": "É um procedimento que usa ondas de choque para fragmentar pedras nos rins sem cirurgia.",
      "Atendem disfunção erétil?": "Sim, a disfunção erétil é tratada pelo urologista com avaliação hormonal e tratamento adequado.",
      "A partir de que idade homens devem consultar?": "É recomendado que homens a partir dos 40-50 anos façam avaliação anual da próstata.",
      "O que devo levar na consulta?": "Exames anteriores, resultados de PSA se tiver, lista de medicamentos e carteirinha do convênio.",
      "Quanto tempo dura a consulta?": "Em média 20 a 30 minutos.",
      "Tratam infecção urinária?": "Sim, infecções urinárias de repetição são avaliadas e tratadas pelo urologista.",
    }
  },

  neurologia: {
    nome: "Neurologia",
    descricao: "Especialidade que trata doenças do sistema nervoso central e periférico.",
    procedimentos_comuns: [
      "Consulta neurológica", "Eletroencefalograma (EEG)", "Solicitação de ressonância do crânio",
      "Avaliação de enxaqueca e cefaleia", "Tratamento de epilepsia",
      "Avaliação de AVC (derrame)", "Tratamento de Parkinson",
      "Avaliação de Alzheimer e demências", "Tratamento de esclerose múltipla",
      "Avaliação de tontura e vertigem", "Tratamento de neuropatia periférica",
      "Aplicação de toxina botulínica para enxaqueca"
    ],
    perguntas_frequentes: {
      "O neurologista trata enxaqueca?": "Sim, a enxaqueca e outros tipos de cefaleia são tratados pelo neurologista com medicamentos preventivos e para as crises.",
      "Fazem eletroencefalograma (EEG)?": "Isso varia por clínica — confirme com nossa equipe.",
      "O médico trata tontura?": "Sim, tonturas de origem neurológica são avaliadas e tratadas. Dependendo da causa, pode haver encaminhamento para otorrinolaringologia.",
      "Atendem casos de AVC?": "O acompanhamento pós-AVC é feito pelo neurologista. Urgências de AVC devem ir ao pronto-socorro.",
      "Tratam Alzheimer?": "Sim, o diagnóstico e acompanhamento de Alzheimer e outras demências são realizados pelo neurologista.",
      "O que devo levar na consulta?": "Exames de imagem anteriores (ressonância, tomografia), eletroencefalogramas e lista detalhada de medicamentos.",
      "Quanto tempo dura a consulta?": "Primeira consulta em média 40 a 60 minutos devido à complexidade da avaliação neurológica.",
      "O neurologista trata ansiedade e depressão?": "Não — ansiedade e depressão são tratadas pelo psiquiatra. O neurologista trata doenças do sistema nervoso.",
      "Tratam epilepsia?": "Sim, o diagnóstico e tratamento de epilepsia com medicamentos anticonvulsivantes são realizados.",
      "Aplicam botox para enxaqueca?": "Isso varia por clínica — confirme com nossa equipe.",
    }
  },

  endocrinologia: {
    nome: "Endocrinologia",
    descricao: "Especialidade que trata doenças hormonais e metabólicas.",
    procedimentos_comuns: [
      "Consulta endocrinológica", "Avaliação de tireoide", "Ultrassom de tireoide",
      "Biopsia de nódulo de tireoide", "Tratamento de diabetes tipo 1 e 2",
      "Tratamento de obesidade", "Avaliação de osteoporose",
      "Tratamento de síndrome metabólica", "Avaliação hormonal completa",
      "Tratamento de baixo crescimento em crianças", "Tratamento de SOP (síndrome dos ovários policísticos)",
      "Avaliação de adrenal e hipófise"
    ],
    perguntas_frequentes: {
      "O endocrinologista trata diabetes?": "Sim, o tratamento e controle do diabetes tipo 1 e 2 é uma das principais especialidades da endocrinologia.",
      "Atendem problemas de tireoide?": "Sim, hipotireoidismo, hipertireoidismo, nódulos e outras doenças da tireoide são tratados pelo endocrinologista.",
      "O médico trata obesidade?": "Sim, a obesidade é tratada com abordagem hormonal, nutricional e, quando indicado, medicamentos.",
      "Atendem SOP (ovários policísticos)?": "Sim, a síndrome dos ovários policísticos é avaliada e tratada pelo endocrinologista.",
      "O que é avaliação hormonal?": "É um conjunto de exames de sangue que mede os níveis hormonais (tireoide, insulina, hormônios sexuais, cortisol, etc.).",
      "O que devo levar na consulta?": "Exames hormonais anteriores, glicemia, hemoglobina glicada (HbA1c) se diabético, e lista de medicamentos.",
      "Precisa estar em jejum?": "Para os exames de sangue solicitados sim, mas para a consulta em si não é necessário.",
      "Quanto tempo dura a consulta?": "Primeira consulta em média 40 a 60 minutos.",
      "Tratam osteoporose?": "Sim, o diagnóstico e tratamento de osteoporose com reposição de cálcio, vitamina D e outros medicamentos são realizados.",
      "Atendem crianças com problema de crescimento?": "Sim, o endocrinologista pediátrico avalia e trata distúrbios do crescimento em crianças.",
      "Tratam colesterol alto?": "Sim, dislipidemia (colesterol e triglicerídeos alterados) é tratada pelo endocrinologista.",
    }
  },

  // Informações gerais que valem para todas as especialidades
  geral: {
    remarcacao: "Para remarcar uma consulta, entre em contato conosco com pelo menos 24 horas de antecedência pelo WhatsApp ou telefone da clínica.",
    cancelamento: "Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência para não gerar cobrança de taxa.",
    atraso_paciente: "Caso se atrase, entre em contato com a clínica. Atrasos superiores a 15 minutos podem resultar em remarcação dependendo da disponibilidade do médico.",
    atraso_medico: "Em caso de atraso do médico, nossa equipe entrará em contato para informar. Agradecemos sua compreensão.",
    documentos_gerais: "Sempre traga documento de identidade, carteirinha do convênio (se houver), exames anteriores e lista de medicamentos em uso.",
    primeira_consulta: "Na primeira consulta, chegue 15 minutos antes para preencher o cadastro. Traga todos os documentos e exames relacionados ao seu problema de saúde.",
    retorno: "Consultas de retorno geralmente são mais rápidas. Traga os exames solicitados na consulta anterior.",
    convenios: "Aceitamos diversos convênios. Entre em contato com nossa equipe para confirmar se seu plano é aceito.",
    particular: "Atendemos também pacientes particulares. Consulte nossa equipe sobre os valores.",
    forma_pagamento: "Aceitamos dinheiro, cartão de débito e crédito. Consulte nossa equipe sobre parcelamento.",
  }
};
