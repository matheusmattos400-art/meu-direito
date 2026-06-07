import { PrismaClient, ConsentTermType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Taxonomia jurídica inicial (categorias e subcategorias).
 * Alimenta a classificação da IA e o BI por categoria.
 */
const CATEGORIES: Array<{
  slug: string;
  name: string;
  description: string;
  subcategories: Array<{ slug: string; name: string }>;
}> = [
  {
    slug: 'consumidor',
    name: 'Direito do Consumidor',
    description: 'Relações de consumo, cobranças indevidas, produtos e serviços.',
    subcategories: [
      { slug: 'cobranca-indevida', name: 'Cobrança indevida' },
      { slug: 'produto-defeituoso', name: 'Produto com defeito' },
      { slug: 'negativacao-indevida', name: 'Negativação indevida' },
      { slug: 'servico-nao-prestado', name: 'Serviço não prestado' },
    ],
  },
  {
    slug: 'trabalhista',
    name: 'Direito do Trabalho',
    description: 'Vínculo empregatício, verbas rescisórias, assédio e jornada.',
    subcategories: [
      { slug: 'verbas-rescisorias', name: 'Verbas rescisórias' },
      { slug: 'horas-extras', name: 'Horas extras' },
      { slug: 'assedio-moral', name: 'Assédio moral' },
      { slug: 'reconhecimento-vinculo', name: 'Reconhecimento de vínculo' },
    ],
  },
  {
    slug: 'familia',
    name: 'Direito de Família',
    description: 'Divórcio, guarda, pensão alimentícia e união estável.',
    subcategories: [
      { slug: 'divorcio', name: 'Divórcio' },
      { slug: 'pensao-alimenticia', name: 'Pensão alimentícia' },
      { slug: 'guarda', name: 'Guarda de filhos' },
      { slug: 'uniao-estavel', name: 'União estável' },
    ],
  },
  {
    slug: 'previdenciario',
    name: 'Direito Previdenciário',
    description: 'Benefícios do INSS, aposentadorias e auxílios.',
    subcategories: [
      { slug: 'aposentadoria', name: 'Aposentadoria' },
      { slug: 'auxilio-doenca', name: 'Auxílio-doença' },
      { slug: 'bpc-loas', name: 'BPC/LOAS' },
      { slug: 'revisao-beneficio', name: 'Revisão de benefício' },
    ],
  },
  {
    slug: 'civel',
    name: 'Direito Cível',
    description: 'Contratos, responsabilidade civil e indenizações.',
    subcategories: [
      { slug: 'contratos', name: 'Contratos' },
      { slug: 'danos-morais', name: 'Danos morais' },
      { slug: 'cobranca', name: 'Cobrança' },
      { slug: 'locacao', name: 'Locação de imóveis' },
    ],
  },
  {
    slug: 'criminal',
    name: 'Direito Criminal',
    description: 'Orientação informativa sobre matéria criminal.',
    subcategories: [
      { slug: 'inquerito', name: 'Inquérito policial' },
      { slug: 'defesa', name: 'Defesa criminal' },
    ],
  },
];

/**
 * Termos de consentimento (LGPD) — versão inicial.
 * O conteúdo integral será revisado pelo jurídico/DPO; aqui registramos
 * os tipos e a versão para o fluxo de consentimento já funcionar.
 */
const CONSENT_TERMS: Array<{
  type: ConsentTermType;
  version: string;
  title: string;
  content: string;
}> = [
  {
    type: ConsentTermType.TERMS_OF_USE,
    version: '1.0.0',
    title: 'Termos de Uso',
    content:
      'Termos de uso da plataforma. Conteúdo provisório — substituir pela versão revisada pelo jurídico.',
  },
  {
    type: ConsentTermType.PRIVACY_POLICY,
    version: '1.0.0',
    title: 'Política de Privacidade',
    content:
      'Política de privacidade conforme a LGPD. Conteúdo provisório — substituir pela versão revisada pelo DPO.',
  },
  {
    type: ConsentTermType.DATA_PROCESSING,
    version: '1.0.0',
    title: 'Consentimento para Tratamento de Dados',
    content:
      'Autorização para tratamento dos dados pessoais informados, com finalidade de triagem jurídica informativa.',
  },
  {
    type: ConsentTermType.INTERNATIONAL_TRANSFER,
    version: '1.0.0',
    title: 'Consentimento para Transferência Internacional',
    content:
      'Autorização para envio de dados pseudonimizados a provedores de IA localizados no exterior, com salvaguardas adequadas.',
  },
  {
    type: ConsentTermType.DOCUMENT_UPLOAD,
    version: '1.0.0',
    title: 'Consentimento para Envio de Documentos',
    content:
      'Autorização para upload e armazenamento criptografado de documentos relacionados ao caso.',
  },
];

const PLANS = [
  { code: 'STARTER', name: 'Starter', priceBRL: 49.9, casesPerMonth: 10, areas: 1, highlights: ['1 área de atuação', 'Até 10 casos triados/mês', 'Workspace e Kanban'] },
  { code: 'PRO', name: 'Pro', priceBRL: 149.9, casesPerMonth: 50, areas: 3, highlights: ['3 áreas de atuação', 'Até 50 casos triados/mês', 'Editor de peças com IA'] },
  { code: 'BUSINESS', name: 'Business', priceBRL: 349.9, casesPerMonth: 1000, areas: 10, highlights: ['Até 10 áreas', 'Volume alto de casos', 'Prioridade no suporte'] },
];

async function main() {
  console.log('🌱 Seed: planos...');
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: { name: p.name, priceBRL: p.priceBRL, casesPerMonth: p.casesPerMonth, areas: p.areas, highlights: p.highlights },
      create: p,
    });
  }

  console.log('🌱 Seed: categorias jurídicas...');
  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: { slug: cat.slug, name: cat.name, description: cat.description },
    });

    for (const sub of cat.subcategories) {
      await prisma.subcategory.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: sub.slug } },
        update: { name: sub.name },
        create: { categoryId: category.id, slug: sub.slug, name: sub.name },
      });
    }
  }

  console.log('🌱 Seed: termos de consentimento (LGPD)...');
  for (const term of CONSENT_TERMS) {
    await prisma.consentTerm.upsert({
      where: { type_version: { type: term.type, version: term.version } },
      update: { title: term.title, content: term.content, isCurrent: true },
      create: {
        type: term.type,
        version: term.version,
        title: term.title,
        content: term.content,
        effectiveAt: new Date(),
        isCurrent: true,
      },
    });
  }

  console.log('✅ Seed concluído.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
