import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding ProductOS demo data...')

  // Clean up
  await prisma.$transaction([
    prisma.promptExecutionLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.workflowStepRun.deleteMany(),
    prisma.workflowRun.deleteMany(),
    prisma.specVersion.deleteMany(),
    prisma.spec.deleteMany(),
    prisma.sourceEvidence.deleteMany(),
    prisma.comparison.deleteMany(),
    prisma.competitorFeature.deleteMany(),
    prisma.competitorKeyUpdate.deleteMany(),
    prisma.competitor.deleteMany(),
    prisma.accountUpdate.deleteMany(),
    prisma.account.deleteMany(),
    prisma.battleCard.deleteMany(),
    prisma.roadmapItem.deleteMany(),
    prisma.ourFeature.deleteMany(),
    prisma.product.deleteMany(),
    prisma.lLMConfig.deleteMany(),
    prisma.prompt.deleteMany(),
    prisma.uploadedFile.deleteMany(),
    prisma.scheduledRefreshJob.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ])

  // Organization
  const org = await prisma.organization.create({
    data: {
      name: 'AcmeCorp',
      slug: 'acmecorp',
      onboardingCompleted: true,
      onboardingStep: 5,
    },
  })

  // Users
  const adminHash = await bcrypt.hash('demo1234', 10)
  const pmHash = await bcrypt.hash('demo1234', 10)

  const adminUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@acmecorp.com',
      passwordHash: adminHash,
      name: 'Alex Admin',
      role: 'ADMIN',
    },
  })

  const pmUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'pm@acmecorp.com',
      passwordHash: pmHash,
      name: 'Pat PM',
      role: 'MEMBER',
    },
  })

  // Product
  const product = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: 'AcmeSupport AI',
      description: 'AI-powered customer support platform with intelligent routing and automation',
    },
  })

  // AUDIT P0-3: intelligence fields are declared on OurFeature — typed Prisma update
  // (was raw SQL with SQLite-only `?` placeholders).
  async function setFeatureIntel(id: string, intel: Record<string, string | boolean | number | null>) {
    if (Object.keys(intel).length === 0) return
    await prisma.ourFeature.update({ where: { id }, data: intel as any })
  }

  const featureBaseData = [
    { name: 'AI Ticket Routing',         description: 'Automatically classifies and routes incoming support tickets to the right team or agent using intent detection and historical routing patterns — no manual rules required.',                                                                                        category: 'Automation',    status: 'AVAILABLE' },
    { name: 'Agent Assist Sidebar',       description: 'Real-time AI suggestions shown in the agent\'s sidebar as they compose replies — including suggested responses, relevant KB articles, similar resolved tickets, and next-best-action hints.',                                                                     category: 'Productivity',  status: 'AVAILABLE' },
    { name: 'Predictive CSAT',            description: 'AI model that predicts customer satisfaction score in real-time before a ticket closes, enabling agents and managers to intervene before a negative experience is locked in.',                                                                                   category: 'Analytics',     status: 'IN_REVIEW' },
    { name: 'Knowledge Base AI Search',   description: 'Semantic search across your entire help center that understands meaning, not just keywords — surfaces the right article even when customers describe their problem in unexpected ways.',                                                                         category: 'Self-Service',  status: 'AVAILABLE' },
    { name: 'Multi-language Support',     description: 'Auto-detect customer language and translate tickets and responses in real time. Agents work in English; customers receive responses in their preferred language.',                                                                                               category: 'Globalization', status: 'AVAILABLE' },
    { name: 'SLA Prediction',             description: 'AI model that predicts SLA breach risk for every active ticket, giving managers and agents real-time visibility into which tickets are at risk of missing their service level agreement.',                                                                      category: 'Analytics',     status: 'AVAILABLE' },
    { name: 'Chat Widget',                description: 'Embeddable AI chat widget for website and in-app self-service. Handles common questions autonomously, collects structured context before human handoff, and syncs all conversations to the ticket inbox.',                                                      category: 'Channels',      status: 'AVAILABLE' },
    { name: 'Conversation Summarization', description: 'AI-generated summaries of long ticket threads capturing the key issue, actions taken, customer sentiment, and resolution status — enabling agents to get context in seconds rather than reading the full thread.',                                               category: 'Productivity',  status: 'AVAILABLE' },
    { name: 'Custom AI Models',           description: 'Fine-tune AcmeSupport AI on your specific product documentation, past ticket history, and internal knowledge base to achieve domain-specific accuracy that generic models cannot match.',                                                                        category: 'Customization', status: 'PLANNED'   },
    { name: 'Integration Hub',            description: 'Pre-built integrations with CRM, billing, product analytics, and engineering tools — plus a REST API and webhooks for custom integrations.',                                                                                                                   category: 'Integrations',  status: 'AVAILABLE' },
    { name: 'Voice Support',              description: 'AI-powered voice channel for support — inbound calls are transcribed in real time, summarized, and routed as tickets. Agents can respond via voice or switch to text seamlessly.',                                                                             category: 'Channels',      status: 'IN_REVIEW' },
    { name: 'Team Performance Dashboard', description: 'AI-powered analytics dashboard giving managers real-time visibility into team productivity, ticket quality, SLA compliance, and CSAT trends — with AI-narrated weekly summaries.',                                                                             category: 'Analytics',     status: 'AVAILABLE' },
    { name: 'Escalation Engine',          description: 'Smart escalation rules that route tickets to senior agents or managers based on ticket complexity, customer tier, sentiment score, and SLA risk — replacing brittle manual escalation triggers.',                                                               category: 'Automation',    status: 'AVAILABLE' },
    { name: 'Sentiment Analysis',         description: 'Real-time detection of customer sentiment on every ticket message — scores range from Very Negative to Very Positive and update as the conversation evolves.',                                                                                                 category: 'Analytics',     status: 'AVAILABLE' },
  ] as const

  const ourFeatures = await Promise.all(
    featureBaseData.map(f => prisma.ourFeature.create({ data: { productId: product.id, ...f } }))
  )

  // Extended intelligence fields per feature (raw UPDATE bypasses stale Prisma client)
  await setFeatureIntel(ourFeatures[0].id, {
    build: '3.4.0', introducedInBuild: '2.0.0', updatedInBuild: '3.4.0',
    owner: 'Alex Admin', platform: 'Web, API', maturityLevel: 'GA',
    isCustomerFacing: 1, isFeatured: 1,
    targetUsers: 'Support operations managers and team leads responsible for queue management',
    valueProposition: 'Eliminate manual routing queues and reduce misrouted tickets by 35% — agents spend time solving, not sorting.',
    tags: JSON.stringify(['core', 'ai', 'routing', 'automation']),
    docsLinks: JSON.stringify([{ label: 'Routing Setup Guide', url: 'https://docs.acmesupport.ai/routing/setup' }, { label: 'Intent Model Reference', url: 'https://docs.acmesupport.ai/routing/intent-model' }]),
    setupLinks: JSON.stringify([{ label: 'Quick Start: AI Routing', url: 'https://docs.acmesupport.ai/quickstart/routing' }]),
    designFiles: JSON.stringify([{ label: 'Routing Config UI — Figma', url: 'https://figma.com/file/routing-config', type: 'figma' }, { label: 'Intent Classification Flow', url: 'https://figma.com/file/intent-flow', type: 'figma' }]),
    releaseNotes: 'v3.4.0: Added confidence score transparency UI. v3.2.0: Multi-queue support. v3.0.0: Intent model v2 with 94% accuracy. v2.0.0: Initial GA release.',
    competitorMappings: JSON.stringify([{ competitorName: 'Forethought', featureName: 'Triage AI', matchStatus: 'PARTIAL', notes: 'Forethought auto-trains on historical data; ours requires taxonomy setup' }, { competitorName: 'Zendesk', featureName: 'AI Copilot Routing', matchStatus: 'AHEAD', notes: 'Our confidence score exposure is a differentiator' }]),
    configDetails: 'Configurable confidence thresholds per queue. Supports up to 50 intent categories. Fallback routing rule required. Retraining cadence: weekly by default.',
    useCases: '1. Route billing tickets to Billing team automatically\n2. Escalate VIP customer tickets to senior agents\n3. Separate Spanish-language tickets to multilingual queue\n4. Flag high-urgency tickets for immediate attention',
    metadataJson: JSON.stringify({ aiModel: 'intent-v2', avgConfidence: 0.94, ticketsRoutedPerDay: 12400, trainingDataSize: '2.1M tickets' }),
    changelogJson: JSON.stringify([{ date: '2024-11-01', version: '3.4.0', summary: 'Confidence score transparency UI', author: 'Alex Admin' }, { date: '2024-08-15', version: '3.2.0', summary: 'Multi-queue routing support', author: 'Alex Admin' }, { date: '2024-05-01', version: '3.0.0', summary: 'Intent model v2 — 94% accuracy', author: 'Pat PM' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'figma', label: 'Routing Config Designs', url: 'https://figma.com/file/routing-config', visible: true, order: 0 }, { id: 'cb2', type: 'notes', label: 'PM Notes', content: 'Intent v3 model is in training — targeting 97% accuracy. Will ship in Q1 2025 as part of 4.0 milestone.', visible: true, order: 1 }, { id: 'cb3', type: 'checklist', label: 'Launch Checklist', items: [{ id: 'c1', text: 'Intent taxonomy finalized', checked: true }, { id: 'c2', text: 'Confidence threshold UI shipped', checked: true }, { id: 'c3', text: 'Customer-facing docs updated', checked: true }, { id: 'c4', text: 'Intent v3 model trained', checked: false }], visible: true, order: 2 }]),
  })

  await setFeatureIntel(ourFeatures[1].id, {
    build: '3.5.0', introducedInBuild: '2.5.0', updatedInBuild: '3.5.0',
    owner: 'Pat PM', platform: 'Web', maturityLevel: 'GA',
    isCustomerFacing: 0, isFeatured: 1,
    targetUsers: 'Customer support agents and their team managers',
    valueProposition: 'Reduce average handle time by 22% and improve first-reply quality by surfacing the best answer before agents start typing.',
    tags: JSON.stringify(['agent', 'productivity', 'ai-assist', 'core']),
    docsLinks: JSON.stringify([{ label: 'Agent Assist Overview', url: 'https://docs.acmesupport.ai/agent-assist/overview' }, { label: 'Suggestion Feedback Guide', url: 'https://docs.acmesupport.ai/agent-assist/feedback' }]),
    setupLinks: JSON.stringify([{ label: 'Enable Agent Assist for your team', url: 'https://docs.acmesupport.ai/quickstart/agent-assist' }]),
    designFiles: JSON.stringify([{ label: 'Sidebar Design System — Figma', url: 'https://figma.com/file/sidebar-v2', type: 'figma' }]),
    releaseNotes: 'v3.5.0: Added similar resolved ticket suggestions. v3.3.0: Next-best-action hints. v3.0.0: KB article suggestions. v2.5.0: Initial release with response suggestions.',
    competitorMappings: JSON.stringify([{ competitorName: 'Forethought', featureName: 'Augment', matchStatus: 'PARTIAL', notes: 'Forethought uses resolved tickets as training — we do too in v3.5' }, { competitorName: 'Zendesk', featureName: 'AI Copilot', matchStatus: 'BEHIND', notes: 'Zendesk auto-draft pre-fills before ticket opens — ours fires inline' }]),
    configDetails: 'Suggestions appear after agent types 10+ characters. Configurable suggestion count (1–5). Feedback thumbs enable suggestion ranking. Requires KB indexed.',
    useCases: '1. Agent handling complex billing dispute — gets suggested resolution from similar past tickets\n2. New agent onboarding — sidebar surfaces approved macros matching ticket content\n3. Compliance review — sidebar flags required disclosure language for regulated industries',
    metadataJson: JSON.stringify({ avgSuggestionAcceptRate: 0.41, avgAHTReduction: '22%', dailyActiveSuggestions: 8300 }),
    changelogJson: JSON.stringify([{ date: '2024-12-01', version: '3.5.0', summary: 'Similar resolved ticket suggestions', author: 'Pat PM' }, { date: '2024-09-10', version: '3.3.0', summary: 'Next-best-action hints added', author: 'Pat PM' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'figma', label: 'Sidebar v2 Designs', url: 'https://figma.com/file/sidebar-v2', visible: true, order: 0 }, { id: 'cb2', type: 'docs', label: 'Agent Assist PRD', url: 'https://notion.so/agent-assist-prd', visible: true, order: 1 }, { id: 'cb3', type: 'notes', label: 'Open Questions', content: 'Should we expose suggestion confidence score to agents? Risk: agents may over-rely on high-confidence suggestions. Discuss in next design review.', visible: true, order: 2 }]),
  })

  await setFeatureIntel(ourFeatures[2].id, {
    build: '4.0.0-beta', introducedInBuild: '4.0.0-beta',
    owner: 'Pat PM', platform: 'Web, API', maturityLevel: 'BETA',
    isCustomerFacing: 1, isFeatured: 0,
    targetUsers: 'Support managers and VPs of CX focused on quality metrics and proactive retention',
    valueProposition: 'Catch at-risk customers before they churn — give managers a real-time alert when a ticket is trending toward a 1–2 star outcome.',
    tags: JSON.stringify(['analytics', 'csat', 'ai', 'beta', 'proactive']),
    docsLinks: JSON.stringify([{ label: 'Predictive CSAT Beta Docs', url: 'https://docs.acmesupport.ai/predictive-csat/beta' }]),
    setupLinks: JSON.stringify([{ label: 'Beta Onboarding Guide', url: 'https://docs.acmesupport.ai/predictive-csat/beta-setup' }]),
    designFiles: JSON.stringify([{ label: 'CSAT Alert UI — Figma', url: 'https://figma.com/file/csat-alert-ui', type: 'figma' }, { label: 'Manager Dashboard Mockups', url: 'https://figma.com/file/csat-dashboard', type: 'figma' }]),
    releaseNotes: 'v4.0.0-beta: Initial beta release. Available to beta program customers. Model trained on 1.8M historical CSAT responses.',
    competitorMappings: JSON.stringify([{ competitorName: 'Zendesk', featureName: 'Predictive CSAT', matchStatus: 'PARTIAL', notes: 'Zendesk offers this in Explore suite; ours fires inline in ticket view' }]),
    configDetails: 'CSAT alert threshold configurable (default: <3 stars predicted). Requires minimum 500 historical CSAT responses to train. Alert delivery: in-app, email, or Slack webhook.',
    useCases: '1. Manager receives Slack alert when enterprise account ticket predicted <3 stars\n2. Agent sees yellow warning banner on ticket trending negative\n3. Weekly report: all tickets where prediction fired but CSAT was not collected',
    metadataJson: JSON.stringify({ modelAccuracy: 0.81, betaCustomers: 12, historicalCSATResponses: '1.8M', targetGA: 'Q2 2025' }),
    changelogJson: JSON.stringify([{ date: '2025-01-15', version: '4.0.0-beta', summary: 'Beta release — Predictive CSAT inline alerts', author: 'Pat PM' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'figma', label: 'Alert UI Mockups', url: 'https://figma.com/file/csat-alert-ui', visible: true, order: 0 }, { id: 'cb2', type: 'checklist', label: 'GA Readiness', items: [{ id: 'c1', text: 'Model accuracy >85% validated', checked: false }, { id: 'c2', text: 'Beta feedback incorporated', checked: false }, { id: 'c3', text: 'Docs complete', checked: false }, { id: 'c4', text: 'Pricing model finalized', checked: false }], visible: true, order: 1 }, { id: 'cb3', type: 'notes', label: 'Beta Learnings', content: 'Beta customers report alert fatigue when threshold set too low. Recommend default threshold of <2.5 stars (not <3) for GA.', visible: true, order: 2 }]),
  })

  await setFeatureIntel(ourFeatures[3].id, {
    build: '3.3.0', introducedInBuild: '1.5.0', updatedInBuild: '3.3.0',
    owner: 'Alex Admin', platform: 'Web, Widget', maturityLevel: 'GA',
    isCustomerFacing: 1, isFeatured: 0,
    targetUsers: 'End customers using the self-service portal, plus KB authors who need search analytics',
    valueProposition: 'Deflect 20–30% of inbound tickets by surfacing the right article at the right moment — before the ticket is submitted.',
    tags: JSON.stringify(['self-service', 'kb', 'search', 'semantic']),
    docsLinks: JSON.stringify([{ label: 'KB Search Setup', url: 'https://docs.acmesupport.ai/kb-search/setup' }, { label: 'Search Analytics Guide', url: 'https://docs.acmesupport.ai/kb-search/analytics' }]),
    setupLinks: JSON.stringify([{ label: 'Indexing your Knowledge Base', url: 'https://docs.acmesupport.ai/kb-search/indexing' }, { label: 'Widget Embed Guide', url: 'https://docs.acmesupport.ai/widget/embed' }]),
    designFiles: JSON.stringify([]),
    releaseNotes: 'v3.3.0: Generative answer synthesis above results. v3.1.0: Zero-results feedback loop. v2.0.0: Semantic reranking. v1.5.0: Initial keyword search.',
    competitorMappings: JSON.stringify([{ competitorName: 'Zendesk', featureName: 'Help Center AI Search', matchStatus: 'PARTIAL', notes: 'Zendesk has generative synthesis; we added in v3.3' }, { competitorName: 'Forethought', featureName: 'Deflect AI', matchStatus: 'BEHIND', notes: 'Forethought pre-submission; ours fires pre and post-submission' }]),
    configDetails: 'Requires KB indexed (auto-runs on article publish). Configurable search widget placement. Zero-results fallback: show Submit Ticket CTA. Exclusion lists supported.',
    useCases: "1. Customer types \"I can't login\" — semantic search surfaces password reset article even without keyword match\n2. Pre-submission widget deflects 25% of password reset tickets\n3. KB author reviews zero-results report to identify content gaps",
    metadataJson: JSON.stringify({ avgDeflectionRate: 0.27, articlesIndexed: 847, avgSearchLatencyMs: 140 }),
    changelogJson: JSON.stringify([{ date: '2024-10-01', version: '3.3.0', summary: 'Generative answer synthesis in search results', author: 'Alex Admin' }, { date: '2024-07-01', version: '3.1.0', summary: 'Zero-results feedback loop for KB authors', author: 'Alex Admin' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'notes', label: 'Generative Synthesis Notes', content: 'Generative synthesis works best when KB articles are structured with clear H2 sections. Recommend KB authoring guide update to enforce consistent structure.', visible: true, order: 0 }]),
  })

  await setFeatureIntel(ourFeatures[4].id, {
    build: '3.1.0', introducedInBuild: '2.2.0', updatedInBuild: '3.1.0',
    owner: 'Alex Admin', platform: 'Web, API', maturityLevel: 'GA',
    isCustomerFacing: 1, isFeatured: 0,
    targetUsers: 'Support teams serving international or multilingual customer bases',
    valueProposition: 'Serve global customers without hiring multilingual agents — expand support coverage to 35 languages with a single team.',
    tags: JSON.stringify(['globalization', 'translation', 'i18n', 'language']),
    docsLinks: JSON.stringify([{ label: 'Language Support Matrix', url: 'https://docs.acmesupport.ai/languages/matrix' }, { label: 'Translation Quality Guide', url: 'https://docs.acmesupport.ai/languages/quality' }]),
    setupLinks: JSON.stringify([{ label: 'Enable Multi-language', url: 'https://docs.acmesupport.ai/languages/setup' }]),
    designFiles: JSON.stringify([]),
    releaseNotes: 'v3.1.0: Added 10 additional languages (now 35 total). v2.8.0: Agent language preference UI. v2.2.0: Initial release — 25 languages.',
    competitorMappings: JSON.stringify([{ competitorName: 'Fin by Intercom', featureName: 'Multilingual Support', matchStatus: 'BEHIND', notes: 'Fin supports 45 languages natively without separate KB instances — we have 35' }]),
    configDetails: 'Auto-detect enabled by default. Manual override available per ticket. Translation powered by DeepL API (configurable). Language routing rules can be layered on top.',
    useCases: '1. Spanish-speaking customer submits ticket — auto-translated for English agent, response auto-translated back\n2. EMEA expansion: enable German/French support without hiring locally\n3. Language-based routing: Japanese tickets → Japan team; all others → US team',
    metadataJson: JSON.stringify({ supportedLanguages: 35, dailyTranslations: 3200, avgTranslationQualityScore: 4.3 }),
    changelogJson: JSON.stringify([{ date: '2024-09-01', version: '3.1.0', summary: 'Added 10 languages — now 35 total', author: 'Alex Admin' }, { date: '2024-04-01', version: '2.2.0', summary: 'Initial multi-language GA (25 languages)', author: 'Alex Admin' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'notes', label: 'Language Gap vs Fin', content: 'Fin supports 45 languages vs our 35. Priority additions for Q1 2025: Arabic, Hindi, Turkish, Vietnamese, Thai.', visible: true, order: 0 }]),
  })

  await setFeatureIntel(ourFeatures[5].id, {
    build: '3.0.0', introducedInBuild: '3.0.0',
    owner: 'Pat PM', platform: 'Web, API', maturityLevel: 'GA',
    isCustomerFacing: 0, isFeatured: 0,
    targetUsers: 'Support managers, ops leads, and enterprise accounts with contracted SLA requirements',
    valueProposition: 'Prevent SLA breaches before they happen — identify at-risk tickets 2+ hours before breach window with 80% accuracy.',
    tags: JSON.stringify(['sla', 'analytics', 'ops', 'enterprise']),
    docsLinks: JSON.stringify([{ label: 'SLA Prediction Setup', url: 'https://docs.acmesupport.ai/sla-prediction/setup' }, { label: 'Alert Configuration', url: 'https://docs.acmesupport.ai/sla-prediction/alerts' }]),
    setupLinks: JSON.stringify([{ label: 'Configure SLA Rules', url: 'https://docs.acmesupport.ai/sla/rules' }]),
    designFiles: JSON.stringify([{ label: 'SLA Heatmap UI — Figma', url: 'https://figma.com/file/sla-heatmap', type: 'figma' }]),
    releaseNotes: 'v3.0.0: Initial GA release. v3.0.1: Fixed false-positive rate on weekend SLA windows.',
    competitorMappings: JSON.stringify([{ competitorName: 'Zendesk', featureName: 'Advanced Analytics Suite', matchStatus: 'BEHIND', notes: 'Zendesk Explore has SLA heatmaps; our real-time prediction is more actionable but less historical depth' }]),
    configDetails: 'SLA rules configured separately (per ticket type, customer tier). Prediction fires every 15 minutes per active ticket. Alert channels: in-app badge, email, Slack webhook.',
    useCases: '1. P1 ticket at 70% breach risk → agent notified 2 hours before breach window\n2. Manager daily summary: all tickets that breached and those that were saved via intervention\n3. Enterprise account with contracted 4-hour response SLA: automatic escalation trigger at 80% risk threshold',
    metadataJson: JSON.stringify({ modelAccuracy: 0.82, avgEarlyWarningHours: 2.3, activeAlerts: 47 }),
    changelogJson: JSON.stringify([{ date: '2024-06-01', version: '3.0.0', summary: 'SLA Prediction GA launch', author: 'Pat PM' }, { date: '2024-06-15', version: '3.0.1', summary: 'Fixed false-positives on weekend SLA windows', author: 'Pat PM' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'notes', label: 'Shopify Issue Context', content: 'Shopify flagged model accuracy at 65% in their environment. Root cause: their SLA windows include business-hours-only logic we did not account for in training. Fix targeted for 3.1.0.', visible: true, order: 0 }]),
  })

  await setFeatureIntel(ourFeatures[6].id, {
    build: '3.6.0', introducedInBuild: '1.0.0', updatedInBuild: '3.6.0',
    owner: 'Alex Admin', platform: 'Web, React, iOS, Android', maturityLevel: 'GA',
    isCustomerFacing: 1, isFeatured: 1,
    targetUsers: 'Product and engineering teams embedding support into their product; end customers using the chat widget',
    valueProposition: 'Add AI-powered self-service to any surface in 10 minutes — reduce inbound ticket volume by capturing answers before submission.',
    tags: JSON.stringify(['channel', 'chat', 'widget', 'embed', 'self-service']),
    docsLinks: JSON.stringify([{ label: 'Widget Installation Guide', url: 'https://docs.acmesupport.ai/widget/install' }, { label: 'Widget Customization', url: 'https://docs.acmesupport.ai/widget/customize' }, { label: 'Widget API Reference', url: 'https://docs.acmesupport.ai/widget/api' }]),
    setupLinks: JSON.stringify([{ label: 'Install the Chat Widget', url: 'https://docs.acmesupport.ai/quickstart/widget' }, { label: 'React SDK Guide', url: 'https://docs.acmesupport.ai/widget/react' }]),
    designFiles: JSON.stringify([{ label: 'Widget Design Tokens', url: 'https://figma.com/file/widget-tokens', type: 'figma' }, { label: 'Chat UI Components', url: 'https://figma.com/file/chat-components', type: 'figma' }]),
    releaseNotes: 'v3.6.0: Mobile SDK (iOS/Android). v3.4.0: Custom theming API. v3.0.0: AI autonomous response mode. v1.0.0: Initial chat widget.',
    competitorMappings: JSON.stringify([{ competitorName: 'Intercom', featureName: 'Unified Inbox', matchStatus: 'PARTIAL', notes: 'Intercom widget is more mature with WhatsApp/SMS; ours focuses on AI resolution quality' }]),
    configDetails: 'Script tag or React/iOS/Android SDK. Custom theming via CSS variables. Autonomous response mode configurable per intent. Ticket sync: real-time via webhook.',
    useCases: '1. SaaS product adds in-app chat for onboarding questions — resolved autonomously without agent involvement\n2. Marketing site widget deflects pricing FAQ before prospect submits ticket\n3. Mobile app SDK: users get contextual support without leaving the app',
    metadataJson: JSON.stringify({ dailyActiveWidgetSessions: 18500, avgAutonomousResolutionRate: 0.38, sdkVersion: '3.6.0' }),
    changelogJson: JSON.stringify([{ date: '2025-01-01', version: '3.6.0', summary: 'Mobile SDK for iOS and Android', author: 'Alex Admin' }, { date: '2024-11-15', version: '3.4.0', summary: 'Custom theming API and CSS variable support', author: 'Alex Admin' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'snippet', label: 'Basic Install Snippet', content: '<script src="https://cdn.acmesupport.ai/widget.js" data-key="YOUR_KEY"></script>', visible: true, order: 0 }, { id: 'cb2', type: 'figma', label: 'Chat UI Components', url: 'https://figma.com/file/chat-components', visible: true, order: 1 }]),
  })

  await setFeatureIntel(ourFeatures[7].id, {
    build: '3.2.0', introducedInBuild: '2.8.0', updatedInBuild: '3.2.0',
    owner: 'Pat PM', platform: 'Web', maturityLevel: 'GA',
    isCustomerFacing: 0, isFeatured: 0,
    targetUsers: 'Support agents handling escalated or transferred tickets; managers reviewing ticket history',
    valueProposition: 'Save 4–7 minutes per complex ticket — agents never need to scroll back through 30-message threads to understand context.',
    tags: JSON.stringify(['ai', 'productivity', 'summarization', 'agent']),
    docsLinks: JSON.stringify([{ label: 'Summarization Feature Docs', url: 'https://docs.acmesupport.ai/summarization/overview' }]),
    setupLinks: JSON.stringify([]),
    designFiles: JSON.stringify([]),
    releaseNotes: 'v3.2.0: Added action items extraction and resolution status. v2.8.0: Initial release with basic summary.',
    competitorMappings: JSON.stringify([{ competitorName: 'Fin by Intercom', featureName: 'Smart Handoff', matchStatus: 'PARTIAL', notes: 'Fin generates handoff summaries; ours covers all ticket types not just handoffs' }]),
    configDetails: 'Auto-generates on tickets >5 messages. Manual trigger available. Summary format configurable (brief/standard/detailed). Available via API for external consumption.',
    useCases: '1. Agent picks up escalated ticket — reads 3-line summary instead of 40-message thread\n2. Manager reviews summary to assess agent handling quality\n3. API pull: summaries exported to CRM for account context',
    metadataJson: JSON.stringify({ avgTimeSavedMinutes: 5.2, dailySummariesGenerated: 4100 }),
    changelogJson: JSON.stringify([{ date: '2024-08-01', version: '3.2.0', summary: 'Action items extraction and resolution status in summary', author: 'Pat PM' }, { date: '2024-03-01', version: '2.8.0', summary: 'Initial release', author: 'Pat PM' }]),
    contentBlocksJson: JSON.stringify([]),
  })

  await setFeatureIntel(ourFeatures[8].id, {
    build: null, introducedInBuild: null,
    owner: 'Pat PM', platform: 'Web, API', maturityLevel: 'ALPHA',
    isCustomerFacing: 1, isFeatured: 0,
    targetUsers: 'Enterprise customers with large proprietary knowledge domains (fintech, healthcare, DevTools)',
    valueProposition: 'Achieve 95%+ routing and resolution accuracy on your specific domain — not possible with off-the-shelf AI trained on general support data.',
    tags: JSON.stringify(['enterprise', 'customization', 'ai', 'fine-tuning', 'planned']),
    docsLinks: JSON.stringify([]),
    setupLinks: JSON.stringify([]),
    designFiles: JSON.stringify([{ label: 'Custom Model Config UI — Early Figma', url: 'https://figma.com/file/custom-model-early', type: 'figma' }]),
    releaseNotes: 'Not yet released. Planned for Q2 2025. Currently in early design phase.',
    competitorMappings: JSON.stringify([{ competitorName: 'Forethought', featureName: 'Custom Training', matchStatus: 'BEHIND', notes: 'Forethought requires PS engagement for custom intents; ours will be self-serve' }]),
    configDetails: 'TBD. Design principle: customer uploads docs and past tickets; model trains async; no PS engagement required for standard use case.',
    useCases: '1. Payments company: custom model trained on their proprietary reconciliation logic\n2. Developer tools company: model understands their API error codes and SDKs natively\n3. Healthcare: HIPAA-compliant fine-tuning on clinical terminology',
    metadataJson: JSON.stringify({ targetLaunch: 'Q2 2025', topRequestingAccounts: ['Stripe', 'Shopify', 'Airbnb'], requestCount: 23 }),
    changelogJson: JSON.stringify([]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'notes', label: 'Design Principles', content: 'Core constraint: must be self-serve. Forethought loses deals on PS-required custom training. Our differentiator is accessible fine-tuning with guardrails. Target: 3-day model training turnaround, no PS required.', visible: true, order: 0 }, { id: 'cb2', type: 'checklist', label: 'Pre-Alpha Checklist', items: [{ id: 'c1', text: 'Architecture approved by infra team', checked: false }, { id: 'c2', text: 'Training pipeline spike complete', checked: false }, { id: 'c3', text: 'HIPAA data handling review', checked: false }, { id: 'c4', text: 'Pricing model agreed', checked: false }], visible: true, order: 1 }]),
  })

  await setFeatureIntel(ourFeatures[9].id, {
    build: '3.5.0', introducedInBuild: '1.0.0', updatedInBuild: '3.5.0',
    owner: 'Alex Admin', platform: 'Web, API', maturityLevel: 'GA',
    isCustomerFacing: 0, isFeatured: 0,
    targetUsers: 'IT and RevOps teams connecting support data to CRM, billing, and product tools',
    valueProposition: 'Connect your support context to every tool your team already uses — 40+ pre-built integrations, zero custom code required.',
    tags: JSON.stringify(['integrations', 'api', 'crm', 'webhooks']),
    docsLinks: JSON.stringify([{ label: 'Integration Hub Docs', url: 'https://docs.acmesupport.ai/integrations/overview' }, { label: 'REST API Reference', url: 'https://docs.acmesupport.ai/api/reference' }, { label: 'Webhook Guide', url: 'https://docs.acmesupport.ai/webhooks/guide' }]),
    setupLinks: JSON.stringify([{ label: 'Connect Salesforce', url: 'https://docs.acmesupport.ai/integrations/salesforce' }, { label: 'Connect Jira', url: 'https://docs.acmesupport.ai/integrations/jira' }, { label: 'Connect Slack', url: 'https://docs.acmesupport.ai/integrations/slack' }]),
    designFiles: JSON.stringify([]),
    releaseNotes: 'v3.5.0: Added Notion, Linear, and PagerDuty. v3.3.0: Salesforce bidirectional sync. v3.0.0: Jira ticket creation. v1.0.0: Slack and email initial.',
    competitorMappings: JSON.stringify([{ competitorName: 'Zendesk', featureName: 'Marketplace (1,200+ Integrations)', matchStatus: 'BEHIND', notes: 'Zendesk marketplace moat is significant — 1200+ vs our 40+. Focus on depth over breadth.' }]),
    configDetails: '40+ pre-built connectors. REST API with OpenAPI spec. Webhook delivery: real-time with retry (3x). API rate limit: 1000 req/min on Enterprise.',
    useCases: '1. Salesforce sync: ticket data flows to opportunity record for CSM context\n2. Jira integration: agent creates bug ticket from support ticket with one click\n3. Slack alerts: P1 tickets trigger channel notification automatically',
    metadataJson: JSON.stringify({ totalIntegrations: 43, dailyAPIRequests: 1200000, topIntegrations: ['Salesforce', 'Slack', 'Jira', 'Zendesk', 'HubSpot'] }),
    changelogJson: JSON.stringify([{ date: '2024-12-15', version: '3.5.0', summary: 'Added Notion, Linear, PagerDuty connectors', author: 'Alex Admin' }, { date: '2024-10-01', version: '3.3.0', summary: 'Salesforce bidirectional sync', author: 'Alex Admin' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'notes', label: 'Integration Roadmap', content: 'Next integrations prioritized by customer request volume: (1) HubSpot bidirectional, (2) Intercom data export, (3) Snowflake data warehouse sync, (4) Gainsight. All targeted for H1 2025.', visible: true, order: 0 }]),
  })

  await setFeatureIntel(ourFeatures[10].id, {
    build: '4.0.0-beta', introducedInBuild: '4.0.0-beta',
    owner: 'Pat PM', platform: 'Web', maturityLevel: 'BETA',
    isCustomerFacing: 1, isFeatured: 0,
    targetUsers: 'Support teams with significant phone support volume looking to consolidate voice and digital support',
    valueProposition: 'Handle voice calls in the same unified workspace as email and chat — AI transcription and summarization cuts after-call work by 50%.',
    tags: JSON.stringify(['voice', 'channel', 'beta', 'telephony']),
    docsLinks: JSON.stringify([{ label: 'Voice Beta Docs', url: 'https://docs.acmesupport.ai/voice/beta' }]),
    setupLinks: JSON.stringify([]),
    designFiles: JSON.stringify([{ label: 'Voice Interface Mockups', url: 'https://figma.com/file/voice-ui', type: 'figma' }]),
    releaseNotes: 'v4.0.0-beta: Limited beta with 5 customers. Real-time transcription, post-call summary, and ticket creation on call end.',
    competitorMappings: JSON.stringify([{ competitorName: 'Zendesk', featureName: 'Voice & SMS Channel', matchStatus: 'BEHIND', notes: 'Zendesk voice is GA and mature; we are still in beta with limited features' }]),
    configDetails: 'Requires Twilio account (bring your own). Configurable IVR menu. Transcript stored per ticket. Call recording opt-in. US/Canada only in beta.',
    useCases: '1. Agent handles call — transcript auto-generates, summary attached to ticket on call end\n2. Inbound call plays IVR menu; AI routes to correct queue before agent picks up\n3. Manager reviews call transcripts for quality scoring',
    metadataJson: JSON.stringify({ betaCustomers: 5, targetGA: 'Q3 2025', geoCoverage: 'US, Canada (beta)' }),
    changelogJson: JSON.stringify([{ date: '2025-02-01', version: '4.0.0-beta', summary: 'Voice Support beta launch', author: 'Pat PM' }]),
    contentBlocksJson: JSON.stringify([{ id: 'cb1', type: 'notes', label: 'Beta Constraints', content: 'Beta is US/Canada only due to Twilio regional complexity. Targeting US-only GA in Q3, global in Q4.', visible: true, order: 0 }]),
  })

  await setFeatureIntel(ourFeatures[11].id, {
    build: '3.4.0', introducedInBuild: '2.0.0', updatedInBuild: '3.4.0',
    owner: 'Alex Admin', platform: 'Web', maturityLevel: 'GA',
    isCustomerFacing: 0, isFeatured: 0,
    targetUsers: 'Support managers, directors of CX, and executive stakeholders reviewing support performance',
    valueProposition: "Get an instant read on your team's health every Monday — AI-narrated summaries replace 2 hours of manual report prep.",
    tags: JSON.stringify(['analytics', 'manager', 'reporting', 'ai-insights']),
    docsLinks: JSON.stringify([{ label: 'Dashboard Guide', url: 'https://docs.acmesupport.ai/dashboard/guide' }, { label: 'Custom Metrics', url: 'https://docs.acmesupport.ai/dashboard/custom-metrics' }]),
    setupLinks: JSON.stringify([]),
    designFiles: JSON.stringify([{ label: 'Dashboard UI — Figma', url: 'https://figma.com/file/dashboard-v3', type: 'figma' }]),
    releaseNotes: 'v3.4.0: AI-narrated weekly summaries. v3.0.0: Custom metric builder. v2.5.0: CSAT trend overlays. v2.0.0: Initial dashboard.',
    competitorMappings: JSON.stringify([{ competitorName: 'Zendesk', featureName: 'Advanced Analytics Suite', matchStatus: 'BEHIND', notes: 'Zendesk Explore has more depth for enterprise BI; our advantage is AI-narrated summaries' }]),
    configDetails: 'Default views: Daily, Weekly, Monthly. Custom metric builder (up to 20 metrics). Scheduled email delivery: weekly AI summary. Export: CSV, PDF.',
    useCases: '1. Monday morning: manager receives AI-narrated team summary with top 3 action items\n2. Director of CX: monthly executive PDF report for board meeting\n3. Agent-level performance view: manager reviews individual AHT, CSAT, and ticket volume',
    metadataJson: JSON.stringify({ dashboardActiveUsers: 340, weeklyEmailSubscribers: 120 }),
    changelogJson: JSON.stringify([{ date: '2024-11-01', version: '3.4.0', summary: 'AI-narrated weekly summaries via email', author: 'Alex Admin' }, { date: '2024-06-01', version: '3.0.0', summary: 'Custom metric builder', author: 'Alex Admin' }]),
    contentBlocksJson: JSON.stringify([]),
  })

  await setFeatureIntel(ourFeatures[12].id, {
    build: '3.0.0', introducedInBuild: '1.5.0', updatedInBuild: '3.0.0',
    owner: 'Alex Admin', platform: 'Web, API', maturityLevel: 'GA',
    isCustomerFacing: 0, isFeatured: 0,
    targetUsers: 'Support operations managers setting up escalation workflows',
    valueProposition: 'Ensure your most important tickets always reach the right person — eliminate escalation blind spots with AI-driven signal detection.',
    tags: JSON.stringify(['automation', 'escalation', 'ops', 'routing']),
    docsLinks: JSON.stringify([{ label: 'Escalation Rules Setup', url: 'https://docs.acmesupport.ai/escalation/rules' }]),
    setupLinks: JSON.stringify([{ label: 'Configure Escalation Policies', url: 'https://docs.acmesupport.ai/escalation/policies' }]),
    designFiles: JSON.stringify([]),
    releaseNotes: 'v3.0.0: Added sentiment-based escalation. v2.0.0: Customer tier escalation. v1.5.0: Initial rule-based escalation.',
    competitorMappings: JSON.stringify([]),
    configDetails: 'Up to 25 escalation rules per org. Conditions: complexity score, SLA risk %, sentiment threshold, customer tier, ticket age. Actions: reassign, notify, add label.',
    useCases: '1. Enterprise customer tier + negative sentiment → auto-escalate to senior agent\n2. SLA breach risk >80% → page on-call manager via Slack\n3. Ticket reassigned 3+ times → flag for ops review',
    metadataJson: JSON.stringify({ activeRules: 8, dailyEscalations: 180 }),
    changelogJson: JSON.stringify([{ date: '2024-06-01', version: '3.0.0', summary: 'Sentiment-based escalation triggers', author: 'Alex Admin' }]),
    contentBlocksJson: JSON.stringify([]),
  })

  await setFeatureIntel(ourFeatures[13].id, {
    build: '2.6.0', introducedInBuild: '2.5.0', updatedInBuild: '2.6.0',
    owner: 'Alex Admin', platform: 'Web, API', maturityLevel: 'GA',
    isCustomerFacing: 0, isFeatured: 0,
    targetUsers: 'Support agents and managers who need to prioritize tickets by customer emotional state',
    valueProposition: 'Never miss an angry customer — real-time sentiment scoring lets agents triage by emotional risk, not just SLA clock.',
    tags: JSON.stringify(['ai', 'sentiment', 'analytics', 'core']),
    docsLinks: JSON.stringify([{ label: 'Sentiment Analysis Docs', url: 'https://docs.acmesupport.ai/sentiment/overview' }]),
    setupLinks: JSON.stringify([]),
    designFiles: JSON.stringify([]),
    releaseNotes: 'v2.5.0: Initial GA release. v2.6.0: Added trend line per ticket conversation.',
    competitorMappings: JSON.stringify([{ competitorName: 'Fin by Intercom', featureName: 'Smart Handoff', matchStatus: 'PARTIAL', notes: 'Intercom shows sentiment at handoff; we show it continuously throughout ticket lifecycle' }]),
    configDetails: 'Scores: Very Negative, Negative, Neutral, Positive, Very Positive. Scoring runs per message. Sentiment trend visible in ticket sidebar. API accessible.',
    useCases: '1. Sentiment trend drops from Neutral to Very Negative mid-conversation → escalation rule fires\n2. Agent sees Very Negative badge → adjusts tone proactively\n3. Weekly sentiment distribution report: identify product areas generating most negative feedback',
    metadataJson: JSON.stringify({ dailySentimentScores: 45000, modelAccuracy: 0.89 }),
    changelogJson: JSON.stringify([{ date: '2024-04-01', version: '2.5.0', summary: 'Sentiment Analysis GA', author: 'Alex Admin' }, { date: '2024-04-20', version: '2.6.0', summary: 'Sentiment trend line added to ticket sidebar', author: 'Alex Admin' }]),
    contentBlocksJson: JSON.stringify([]),
  })

  // Feature Q&A, Solutions, and Feedback samples
  // ourFeatures[0] = AI Ticket Routing, [1] = Agent Assist, [2] = Predictive CSAT, [6] = Chat Widget
  await Promise.all([
    // Q&A — AI Ticket Routing
    (prisma as any).featureQuestion.create({
      data: {
        featureId: ourFeatures[0].id,
        question: 'What is the minimum number of historical tickets needed for the model to start routing accurately?',
        askedBy: 'Sarah (CSM)',
        status: 'ANSWERED',
        answersJson: JSON.stringify([
          { id: 'a1', content: 'The intent model reaches useful accuracy (~85%) with around 5,000 historical tickets per intent category. For full accuracy (94%+) we recommend 10,000+ tickets per category. Customers with fewer tickets start with our pre-trained base model and improve over time as more tickets accumulate.', answeredBy: 'Pat PM', isBest: true, isApproved: true, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        ]),
      },
    }),
    (prisma as any).featureQuestion.create({
      data: {
        featureId: ourFeatures[0].id,
        question: 'Can we configure different confidence thresholds for different ticket categories?',
        askedBy: 'Marcus (Solutions Engineer)',
        status: 'ANSWERED',
        answersJson: JSON.stringify([
          { id: 'a2', content: 'Yes — confidence thresholds are configurable per-queue, not globally. So you can require 95% confidence before auto-routing to your Enterprise queue while accepting 80% confidence for general inquiries. This is accessible in Settings → Routing → Queue Configuration.', answeredBy: 'Alex Admin', isBest: true, isApproved: true, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        ]),
      },
    }),
    (prisma as any).featureQuestion.create({
      data: {
        featureId: ourFeatures[0].id,
        question: 'Does the routing model retrain automatically or do we need to trigger it manually?',
        askedBy: 'Lisa (Support Ops)',
        status: 'OPEN',
        answersJson: JSON.stringify([]),
      },
    }),

    // Q&A — Agent Assist
    (prisma as any).featureQuestion.create({
      data: {
        featureId: ourFeatures[1].id,
        question: 'How do we ensure agents don\'t become over-reliant on suggestions and stop thinking critically?',
        askedBy: 'Tom (Support Manager)',
        status: 'ANSWERED',
        answersJson: JSON.stringify([
          { id: 'a3', content: 'This is a real concern based on our beta data. We recommend: (1) framing suggestions as "starting points" not "answers" in agent training, (2) reviewing suggestion acceptance rate by agent — if >70% acceptance without edits, flag for coaching, (3) using the feedback buttons (thumbs up/down) to track quality. We\'re also working on a "suggestion review mode" for manager dashboards in Q1 2025.', answeredBy: 'Pat PM', isBest: true, isApproved: true, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        ]),
      },
    }),
    (prisma as any).featureQuestion.create({
      data: {
        featureId: ourFeatures[1].id,
        question: 'Does Agent Assist work with Zendesk or only our native inbox?',
        askedBy: 'Rachel (Sales Engineer)',
        status: 'ANSWERED',
        answersJson: JSON.stringify([
          { id: 'a4', content: 'Currently Agent Assist works exclusively in our native agent workspace. A Zendesk sidebar integration is on the roadmap for H2 2025 — it would inject our suggestions into the Zendesk ticket view via their Apps Framework. No confirmed date yet.', answeredBy: 'Alex Admin', isBest: false, isApproved: true, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
          { id: 'a5', content: 'Confirming Alex\'s answer — Zendesk integration is tracked in our H2 roadmap but not committed. If you have a customer asking for this, please add them to the tracking list in the Integration Hub notes.', answeredBy: 'Pat PM', isBest: true, isApproved: true, createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
        ]),
      },
    }),

    // Q&A — Predictive CSAT
    (prisma as any).featureQuestion.create({
      data: {
        featureId: ourFeatures[2].id,
        question: 'What happens when the CSAT prediction fires but the customer doesn\'t fill out the survey — can we still trust the signal?',
        askedBy: 'Jamie (Customer Success)',
        status: 'ANSWERED',
        answersJson: JSON.stringify([
          { id: 'a6', content: 'The prediction fires based on conversation signals (sentiment trend, message count, response delay patterns, agent language quality), not on survey completion. So yes, it provides signal even when customers don\'t respond to CSAT surveys. In fact, this is one of the key value propositions — you get proactive signal for the ~60% of customers who never fill out surveys.', answeredBy: 'Pat PM', isBest: true, isApproved: true, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        ]),
      },
    }),

    // Q&A — Chat Widget
    (prisma as any).featureQuestion.create({
      data: {
        featureId: ourFeatures[6].id,
        question: 'Can we show the chat widget only on specific pages, not site-wide?',
        askedBy: 'Dev Team (Acme)',
        status: 'ANSWERED',
        answersJson: JSON.stringify([
          { id: 'a7', content: 'Yes — use the widget\'s `targetPaths` configuration option. You can pass an array of path patterns (supports wildcards) to show/hide the widget per page. Example: `targetPaths: [\'/support/*\', \'/dashboard\']` will only show the widget on support pages and the main dashboard. See the Widget API docs for full reference.', answeredBy: 'Alex Admin', isBest: true, isApproved: true, createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
        ]),
      },
    }),

    // Solutions — AI Ticket Routing
    (prisma as any).featureSolution.create({
      data: {
        featureId: ourFeatures[0].id,
        title: 'How to configure confidence thresholds per queue',
        content: 'Navigate to Settings → Routing → Queue Configuration. Select the queue you want to adjust. Under "Intent Routing", set the minimum confidence threshold (0–100%). Tickets that don\'t meet the threshold fall back to your default fallback queue. Recommended starting values: Enterprise queue → 92%, General → 80%, Catch-all → 0%.',
        type: 'SETUP',
        tags: JSON.stringify(['routing', 'confidence', 'setup']),
      },
    }),
    (prisma as any).featureSolution.create({
      data: {
        featureId: ourFeatures[0].id,
        title: 'Objection: "Our tickets are too unique for AI routing to work"',
        content: 'Acknowledge: AI routing works best with repeating patterns. Pivot: ask what percentage of tickets are truly unique vs. variations of common themes — most teams discover 70–80% of their volume is patternable. Offer: start with a 30-day pilot on a single high-volume queue (e.g., password resets, billing questions) to demonstrate accuracy before committing to full deployment. This handles the "prove it first" objection without requiring full onboarding.',
        type: 'OBJECTION',
        tags: JSON.stringify(['objection', 'sales', 'routing']),
      },
    }),
    (prisma as any).featureSolution.create({
      data: {
        featureId: ourFeatures[0].id,
        title: 'FAQ: Why is a ticket being routed to the wrong queue?',
        content: 'Most misrouting is caused by one of three things:\n1. Low confidence score — check the routing audit log; if confidence was below threshold, the fallback rule fired.\n2. Missing intent category — the ticket intent may not be in your configured taxonomy. Check Settings → Intent Categories for gaps.\n3. Training data imbalance — if one queue has 10x more historical tickets, the model may over-index on it. Contact support for a rebalancing review.\n\nThe routing audit log (Settings → Routing → Audit Log) shows confidence scores for every routed ticket — start there.',
        type: 'TROUBLESHOOT',
        tags: JSON.stringify(['troubleshoot', 'routing', 'misrouting']),
      },
    }),

    // Solutions — Agent Assist
    (prisma as any).featureSolution.create({
      data: {
        featureId: ourFeatures[1].id,
        title: 'Approved positioning for Agent Assist vs Zendesk Copilot',
        content: 'Key message: "AcmeSupport Agent Assist improves inline, as your agents type — so suggestions are always contextually relevant to the current message, not pre-filled from a stale auto-draft."\n\nDifferentiator: Zendesk Copilot auto-drafts before the agent opens the ticket (which can feel disconnected from what the customer just wrote). Our approach is real-time and message-aware.\n\nUse this framing when prospect says "Zendesk already has AI Copilot." Acknowledge, then pivot to the inline vs pre-fill distinction.',
        type: 'OBJECTION',
        tags: JSON.stringify(['objection', 'competitive', 'zendesk', 'sales']),
      },
    }),
    (prisma as any).featureSolution.create({
      data: {
        featureId: ourFeatures[1].id,
        title: 'How to interpret suggestion acceptance rate in reporting',
        content: 'Suggestion acceptance rate is available in Analytics → Agent Assist → by agent or team.\n\n- <20% acceptance: agents may not be seeing the sidebar, OR suggestions are low quality. Check sidebar visibility settings first.\n- 20–50% acceptance: healthy range — agents are using suggestions as a starting point and editing.\n- >70% acceptance without edits: potential over-reliance risk. Flag for manager coaching.\n- Zero data: KB may not be indexed. Check Settings → Knowledge Base → Indexing Status.',
        type: 'FAQ',
        tags: JSON.stringify(['reporting', 'analytics', 'agent-assist']),
      },
    }),

    // Solutions — Chat Widget
    (prisma as any).featureSolution.create({
      data: {
        featureId: ourFeatures[6].id,
        title: 'Minimal embed snippet for web',
        content: '<!-- Add before </body> -->\n<script\n  src="https://cdn.acmesupport.ai/widget.js"\n  data-key="YOUR_API_KEY"\n  data-position="bottom-right"\n  data-primary-color="#0066CC"\n></script>\n\nReplace YOUR_API_KEY with the key from Settings → Widget → API Keys. Full config options at docs.acmesupport.ai/widget/api.',
        type: 'SNIPPET',
        tags: JSON.stringify(['snippet', 'embed', 'javascript', 'widget']),
      },
    }),
    (prisma as any).featureSolution.create({
      data: {
        featureId: ourFeatures[6].id,
        title: 'Workaround: show widget only on specific pages without code changes',
        content: 'If you can\'t modify the embed code, use the URL-based trigger in Widget Settings. Set "Target URL patterns" to a comma-separated list of URL fragments (e.g., `/support, /help`). The widget JavaScript checks the current URL and auto-hides on non-matching pages. Note: this requires the widget to still load globally — use the `targetPaths` API parameter for a cleaner solution if code changes are possible.',
        type: 'WORKAROUND',
        tags: JSON.stringify(['workaround', 'widget', 'pages', 'display']),
      },
    }),

    // Feedback — AI Ticket Routing
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[0].id,
        title: 'Routing audit log is hard to find — should be surfaced more prominently',
        content: 'Multiple customers have asked me where to find the routing audit log. It\'s buried in Settings → Routing → Audit Log. Should be linked directly from the Routing dashboard or accessible from a misrouted ticket\'s action menu.',
        type: 'IMPROVEMENT',
        submittedBy: 'Sarah (CSM)',
        status: 'IN_REVIEW',
        tags: JSON.stringify(['ux', 'discoverability', 'audit-log']),
      },
    }),
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[0].id,
        title: 'Customer request: Slack alert when intent model needs retraining',
        content: 'Stripe account asked for a Slack notification when routing accuracy drops below a configured threshold (signal that intent model needs retraining). Currently this requires manual monitoring of the routing health dashboard.',
        type: 'CUSTOMER_REQUEST',
        submittedBy: 'Marcus (Solutions)',
        status: 'OPEN',
        tags: JSON.stringify(['slack', 'alerting', 'model-health', 'stripe']),
      },
    }),
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[0].id,
        title: 'Confidence score tooltip is confusing — customers think 80% means wrong 20% of the time',
        content: 'Shopify support ops team was confused by the confidence score label. They interpreted "80% confidence" as "will misroute 20% of tickets" when it actually means the model is 80% sure about this specific intent. The tooltip/help text needs to explain the meaning more clearly with an example.',
        type: 'CONFUSION',
        submittedBy: 'Lisa (CSM)',
        status: 'ADDRESSED',
        tags: JSON.stringify(['ux', 'copy', 'tooltip', 'confidence']),
      },
    }),

    // Feedback — Agent Assist
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[1].id,
        title: 'Suggestion panel covers part of the ticket history on 13" screens',
        content: 'Agents on 13" MacBooks report the suggestion sidebar overlaps the last 2-3 messages of ticket history when the sidebar is expanded. Makes it hard to see what the customer just wrote while reading suggestions. Reported by 3 customers so far.',
        type: 'BUG',
        submittedBy: 'Tom (Support Manager)',
        status: 'IN_REVIEW',
        tags: JSON.stringify(['bug', 'responsive', 'sidebar', 'layout']),
      },
    }),
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[1].id,
        title: 'Forethought uses historical resolved tickets as suggestion training — we should too',
        content: 'Came up in a competitive deal vs Forethought. Their Augment feature pulls from both KB articles AND historically resolved tickets to surface suggestions. Our sidebar only uses KB. The "similar past tickets" signal is very powerful for complex domains. Suggests we should expand suggestion sources.',
        type: 'COMPETITIVE',
        submittedBy: 'Rachel (Sales)',
        status: 'IN_REVIEW',
        tags: JSON.stringify(['competitive', 'forethought', 'suggestions', 'training-data']),
      },
    }),

    // Feedback — Predictive CSAT
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[2].id,
        title: 'Default threshold of <3 stars causes too many alerts — alert fatigue in beta',
        content: 'All 12 beta customers have reported the default prediction threshold (<3 stars) fires too frequently. Managers are ignoring alerts after the first week. Recommend changing the default to <2.5 stars (very negative only) for GA, with guidance to loosen it once teams understand the signal.',
        type: 'IMPROVEMENT',
        submittedBy: 'Jamie (Customer Success)',
        status: 'ADDRESSED',
        tags: JSON.stringify(['beta', 'threshold', 'alert-fatigue', 'defaults']),
      },
    }),

    // Feedback — Chat Widget
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[6].id,
        title: 'React SDK missing TypeScript types — painful for TypeScript codebases',
        content: 'Two enterprise customers (both TypeScript-first) flagged that the React SDK ships without TypeScript declaration files (.d.ts). They\'re working around it with `@ts-ignore` but it\'s a friction point for adoption. Should be a quick fix but blocker for some teams.',
        type: 'DOCS_ISSUE',
        submittedBy: 'Dev Team (Solutions)',
        status: 'OPEN',
        tags: JSON.stringify(['typescript', 'sdk', 'dx', 'react']),
      },
    }),
    (prisma as any).featureFeedback.create({
      data: {
        featureId: ourFeatures[6].id,
        title: 'Config option needed to disable widget on mobile breakpoints',
        content: 'Several customers want the chat widget visible on desktop but hidden on mobile (where they use a native SDK instead). Currently requires custom CSS hack. A first-class `hideOnMobile` config option would make this clean and supported.',
        type: 'CUSTOMER_REQUEST',
        submittedBy: 'Alex Admin',
        status: 'OPEN',
        tags: JSON.stringify(['mobile', 'responsive', 'config', 'widget']),
      },
    }),
  ])

  // Competitors (5)
  const forethought = await prisma.competitor.create({
    data: {
      organizationId: org.id,
      name: 'Forethought',
      website: 'https://forethought.ai',
      description: 'AI-native customer support platform offering intelligent triage, deflection, and agent augmentation across the full support lifecycle.',
      monitoringEnabled: true,
      refreshFrequencyDays: 15,
      lastRefreshAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  })

  const fin = await prisma.competitor.create({
    data: {
      organizationId: org.id,
      name: 'Fin by Intercom',
      website: 'https://www.intercom.com/fin',
      description: 'GPT-4 powered AI agent that resolves complex support questions conversationally, with seamless handoff to human agents.',
      monitoringEnabled: true,
      refreshFrequencyDays: 15,
      lastRefreshAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  })

  const zendesk = await prisma.competitor.create({
    data: {
      organizationId: org.id,
      name: 'Zendesk',
      website: 'https://www.zendesk.com',
      description: 'Enterprise customer service suite with AI Copilot, omnichannel support, and advanced workforce management tools.',
      monitoringEnabled: true,
      refreshFrequencyDays: 15,
      lastRefreshAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  })

  const intercom = await prisma.competitor.create({
    data: {
      organizationId: org.id,
      name: 'Intercom',
      website: 'https://www.intercom.com',
      description: 'Conversational customer engagement platform combining AI chat, in-app messaging, product tours, and help center into one connected workspace.',
      monitoringEnabled: true,
      refreshFrequencyDays: 15,
      lastRefreshAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  })

  const gorgias = await prisma.competitor.create({
    data: {
      organizationId: org.id,
      name: 'Gorgias',
      website: 'https://www.gorgias.com',
      description: 'E-commerce helpdesk with deep Shopify/BigCommerce integrations, AI-powered automation, and revenue attribution for support teams.',
      monitoringEnabled: true,
      refreshFrequencyDays: 15,
      lastRefreshAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  })

  // Competitor Features — Forethought
  const forethoughtFeatures = await Promise.all([
    prisma.competitorFeature.create({
      data: {
        competitorId: forethought.id,
        name: 'Triage AI',
        description: 'Automatically classifies, tags, and routes incoming tickets using intent detection and historical patterns — no manual rules required.',
        category: 'AI',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'BEHIND',
        roadmapImplicationText: 'Our routing lacks intent-based classification. Forethought trains on ticket history automatically — we require manual rule setup.',
        prosText: '• Achieves 90%+ routing accuracy on day one using historical ticket patterns\n• Zero-config setup — no manual tagging rules or taxonomy design needed\n• Continuously retrains as new ticket patterns emerge, improving over time',
        consText: '• Black-box model makes it hard to audit or override specific routing decisions\n• Requires a meaningful volume of historical tickets (typically 10k+) to reach peak accuracy\n• Limited support for highly custom or domain-specific taxonomies without professional services',
        marketSentimentText: 'Forethought positions Triage AI as the replacement for rule-based routing, emphasizing "zero-configuration intelligence" and time-to-value. Their messaging centers on the ROI narrative: customers eliminate weeks of rules setup and see immediate accuracy gains, which resonates strongly with ops-heavy support teams that are exhausted by brittle Zendesk trigger maintenance.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: forethought.id,
        name: 'Deflect AI',
        description: 'Surfaces relevant knowledge base articles in real-time as customers type their question, deflecting tickets before they are submitted.',
        category: 'Self-Service',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        roadmapImplicationText: 'Our KB search fires post-submission. Forethought intercepts pre-submission which meaningfully changes deflection rates.',
        prosText: '• Pre-submission interception catches intent while customer intent is still fresh and actionable\n• Semantic matching surfaces non-obvious articles that keyword search misses\n• Deflection rate is directly measurable — customers see clear ROI within weeks of deploy',
        consText: '• Effectiveness is tightly coupled to KB quality — stale or thin content drastically reduces deflection\n• Widget UX can feel intrusive if not carefully configured, increasing abandon rates rather than deflection\n• No native authoring feedback loop to identify which articles need to be created or updated',
        marketSentimentText: 'Forethought markets Deflect AI around the "deflection before submission" insight, framing it as fundamentally different from post-submission bots. Their case studies consistently lead with deflection rate improvements (typically 20-35%), targeting support leaders who are measured on ticket volume reduction rather than CSAT.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: forethought.id,
        name: 'Augment (Agent Assist)',
        description: 'Real-time suggested responses, relevant KB articles, and next-best-action hints shown in agent\'s sidebar while they type.',
        category: 'Productivity',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        prosText: '• Suggestions appear inline as agents compose replies, minimizing context-switching\n• Next-best-action hints draw on both KB content and similar resolved tickets\n• Works across Zendesk, Salesforce Service Cloud, and Freshdesk without custom integration work',
        consText: '• Suggestion quality degrades when KB and resolved ticket corpus are small or inconsistent\n• Agents report suggestion fatigue in high-volume environments — dismissal rates rise after first month\n• No mechanism for agents to rate or improve suggestions, limiting the feedback loop',
        marketSentimentText: 'Forethought positions Augment as the "co-pilot that knows your support history," differentiating on the use of historical resolved tickets — not just KB articles — as a training source. This resonates with tenured support teams where tribal knowledge is high but undocumented.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: forethought.id,
        name: 'Solve (Autonomous AI)',
        description: 'Fully autonomous AI agent that resolves tickets end-to-end for defined intents without any human involvement.',
        category: 'Automation',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'BEHIND',
        prosText: '• End-to-end resolution for defined intent clusters with no human in the loop\n• Integrates with backend systems (Salesforce, Zendesk) to take actions, not just answer questions\n• Clear per-intent confidence thresholds let teams control automation scope precisely',
        consText: '• Intent scope must be defined upfront — teams need PM-level effort to map and scope automatable intents\n• Autonomous actions (e.g., issuing refunds) require careful guardrails that take significant setup time\n• Customer transparency about AI handling is limited — no clear disclosure framework built in',
        marketSentimentText: 'Forethought pitches Solve as the path to "lights-out support" for predictable intents, deliberately scoping the promise narrowly to avoid the trust deficit of earlier chatbot generations. Their positioning avoids the word "chatbot" entirely, instead using "autonomous resolution" to signal a quality-first approach.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: forethought.id,
        name: 'Insights Dashboard',
        description: 'AI-generated analytics on deflection rates, intent distribution, and automation ROI with trend visualizations.',
        category: 'Analytics',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'NO_MATCH',
        prosText: '• AI-narrated summaries translate raw metrics into plain-language PM and exec-ready takeaways\n• Intent distribution view exposes which topic clusters are growing fastest — useful for roadmap input\n• Automation ROI calculator makes cost justification straightforward for budget reviews',
        consText: '• Dashboard is read-only — no ability to drill into individual tickets from a trend spike\n• Export options are limited to CSV; no native BI tool connector or webhook for data warehouse sync\n• Intent taxonomy in analytics is Forethought\'s own, not aligned to the customer\'s internal taxonomy',
        marketSentimentText: 'Forethought markets Insights as the "ROI proof layer" that justifies the overall platform investment, frequently featuring it in renewal and expansion conversations. The AI-narrated summary feature is a differentiator they lead with in product demos, positioning analytics as a strategic business tool rather than an operational report.',
      },
    }),
  ])

  // Competitor Features — Fin by Intercom
  const finFeatures = await Promise.all([
    prisma.competitorFeature.create({
      data: {
        competitorId: fin.id,
        name: 'Conversational AI Resolution',
        description: 'Uses GPT-4 to answer complex multi-turn support questions directly from connected knowledge sources, resolving up to 51% of volume.',
        category: 'AI',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'BEHIND',
        roadmapImplicationText: 'Fin achieves 51% resolution using LLM reasoning over KB content. Our chatbot uses retrieval only — consider adding LLM reasoning layer.',
        prosText: '• 51% resolution rate is among the highest published benchmarks in the industry for AI support agents\n• Multi-turn reasoning handles nuanced follow-up questions without losing conversation context\n• No training required — connects to existing help center content and is production-ready in hours',
        consText: '• Resolution rate is heavily KB-quality dependent; teams with thin or outdated content see much lower numbers\n• GPT-4 reasoning can produce confident but incorrect answers when KB content is ambiguous or contradictory\n• Cost per resolution scales with conversation length — complex multi-turn sessions can be expensive at high volume',
        marketSentimentText: 'Intercom leads all Fin marketing with the "51% resolution" number, framing it as a proven, measurable outcome rather than a capability. Their messaging deliberately contrasts with legacy chatbots by emphasizing that Fin "reads and reasons" rather than following decision trees, which resonates with buyers burned by previous chatbot investments.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: fin.id,
        name: 'Smart Handoff to Agents',
        description: 'Intelligently transfers conversation to human agent with full context summary, sentiment score, and suggested next steps pre-filled.',
        category: 'Automation',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        prosText: '• Auto-generated context summary means agents never need to ask customers to repeat themselves\n• Sentiment score at handoff enables priority routing — frustrated customers reach senior agents faster\n• Suggested next steps reduce agent ramp time on complex or escalated conversations',
        consText: '• Handoff experience is tightly coupled to Intercom\'s own inbox — non-Intercom agent tools get a degraded integration\n• Summary quality degrades on very long or fragmented conversations with multiple topic shifts\n• Customers cannot choose to bypass AI and reach a human directly without explicit configuration',
        marketSentimentText: 'Intercom positions Smart Handoff as the feature that "makes the AI-human boundary invisible to the customer," emphasizing continuity of experience as a trust-building mechanism. Sales decks routinely show before/after CSAT comparisons to demonstrate that customers do not penalize teams for AI-first routing.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: fin.id,
        name: 'Custom Answers',
        description: 'Product team can define specific verbatim answers for high-stakes questions (pricing, legal, etc.) that Fin uses instead of generating.',
        category: 'Self-Service',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'NO_MATCH',
        prosText: '• Gives compliance and legal teams exact control over AI responses on sensitive topics\n• Verbatim answers bypass LLM generation entirely, eliminating hallucination risk for critical topics\n• Easy to audit — custom answer library is a simple searchable list, not a black-box training set',
        consText: '• Maintaining a growing library of custom answers creates ongoing editorial overhead\n• No automated suggestion for which topics should become custom answers — requires manual curation\n• Custom answers can become stale quickly in fast-moving product or pricing environments',
        marketSentimentText: 'Intercom markets Custom Answers as the "guardrails layer" that makes enterprise compliance teams comfortable with AI deployment, directly addressing the objection that AI cannot be trusted for regulated or liability-sensitive content. It is frequently cited in financial services and healthcare customer stories.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: fin.id,
        name: 'Fin Insights',
        description: 'Analytics dashboard showing resolution rate, handoff reasons, unanswered question patterns, and content gap identification.',
        category: 'Analytics',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'NO_MATCH',
        prosText: '• Unanswered question clustering automatically surfaces KB content gaps without manual ticket review\n• Handoff reason analysis pinpoints which intents are under-automated and why\n• Resolution rate trend view makes it easy to correlate KB updates with performance changes',
        consText: '• Analytics are Fin-specific — no unified view combining human agent and AI performance\n• Content gap recommendations are topic clusters, not specific article suggestions\n• Data retention for conversation-level analytics is capped at 90 days on standard plans',
        marketSentimentText: 'Intercom positions Fin Insights as the "continuous improvement engine" that turns the AI agent into a self-improving system, marketing it as the tool that closes the loop between AI performance and knowledge management. It is frequently used in QBR settings to demonstrate ongoing value.',
      },
    }),
  ])

  // Competitor Features — Zendesk
  const zendeskFeatures = await Promise.all([
    prisma.competitorFeature.create({
      data: {
        competitorId: zendesk.id,
        name: 'AI Copilot (Agent Assist)',
        description: 'Real-time AI suggestions for ticket replies, macro recommendations, and knowledge retrieval shown in agent workspace sidebar.',
        category: 'AI',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        roadmapImplicationText: 'Zendesk Copilot integrates deeply with their macro/template system. Our assist lacks this workflow integration layer.',
        prosText: '• Deep integration with Zendesk macros and triggers means suggestions slot into existing agent workflows naturally\n• Auto-draft generates complete reply before agent opens ticket, compressing handle time significantly\n• Copilot learns from macro acceptance patterns, improving suggestion relevance over time per agent',
        consText: '• Only available within Zendesk\'s own agent workspace — no value for teams using third-party inboxes\n• Copilot suggestions can conflict with mandatory compliance language agents must include, causing manual overrides\n• Accuracy on highly technical or product-specific queries is inconsistent without extensive KB enrichment',
        marketSentimentText: 'Zendesk positions AI Copilot as the center of their "AI-first agent experience" narrative, emphasizing that it augments rather than replaces agents — a deliberate choice to neutralize frontline agent resistance. Marketing materials focus on measurable AHT reduction (typically 20-30%) and tie Copilot to their broader Suite upsell story.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: zendesk.id,
        name: 'Advanced Analytics Suite',
        description: 'Explore dashboards with custom metrics, funnel analysis, SLA heatmaps, and predictive CSAT forecasting for enterprise reporting.',
        category: 'Analytics',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'BEHIND',
        prosText: '• Explore\'s custom query builder gives analysts full flexibility without requiring data warehouse access\n• Predictive CSAT model flags at-risk tickets before agents close them, enabling proactive recovery\n• SLA heatmaps and funnel analysis are enterprise-grade and satisfy most security/compliance reporting needs',
        consText: '• Explore has a steep learning curve — most teams need dedicated analyst time or professional services to realize full value\n• Predictive CSAT requires large historical CSAT response volumes to reach meaningful accuracy\n• Real-time dashboards have a 1-5 minute data lag, making them unsuitable for live operations centers',
        marketSentimentText: 'Zendesk markets Advanced Analytics as the enterprise analytics standard for CX, positioning Explore as "the BI tool built for support." Their messaging targets VP and C-suite buyers who need board-ready reporting, and the predictive CSAT feature is a consistent highlight in enterprise sales cycles where proactive retention is a board-level priority.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: zendesk.id,
        name: 'Voice & SMS Channel',
        description: 'Native voice with call recording, AI transcription, post-call summaries, and SMS — all within the same agent interface.',
        category: 'Channels',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'BEHIND',
        prosText: '• Native voice eliminates the need for a separate CCaaS platform for teams with moderate call volume\n• AI transcription and post-call summary reduce after-call work time by 40-60% in customer benchmarks\n• Unified interface means voice and digital tickets share the same queue, routing, and reporting',
        consText: '• Call quality and reliability lag behind dedicated CCaaS platforms like Five9 or Genesys at high volume\n• SMS channel lacks MMS support and has limited carrier coverage outside the US and Canada\n• Voice AI features (transcription, summarization) are add-on priced, significantly raising per-seat cost',
        marketSentimentText: 'Zendesk markets Voice as the "phone channel you don\'t need a separate vendor for," targeting mid-market teams that want to consolidate their telephony and digital support stack. The AI transcription angle is used to deflect CCaaS competitors by emphasizing the intelligence layer they cannot match natively.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: zendesk.id,
        name: 'Help Center AI Search',
        description: 'Semantic search across knowledge base articles with auto-suggestions and generative answer synthesis for end users.',
        category: 'Self-Service',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        prosText: '• Semantic search dramatically improves findability for users who don\'t know the right keyword\n• Generative answer synthesis surfaces a direct answer above article results, reducing time-to-resolution\n• Deep integration with Zendesk Guide means no separate KB platform or sync pipeline needed',
        consText: '• Generative synthesis can combine information from multiple articles inaccurately when content is inconsistent\n• No feedback loop from failed searches to KB authoring workflow — content gaps are invisible without manual review\n• AI search is only available on higher-tier Suite plans, limiting access for cost-sensitive customers',
        marketSentimentText: 'Zendesk positions Help Center AI Search as the modernization of self-service, emphasizing the shift from "find an article" to "get an answer." Their messaging directly references evolving user expectations set by AI-powered search as a bar they are now meeting in enterprise support contexts.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: zendesk.id,
        name: 'Marketplace (1,200+ Integrations)',
        description: 'Pre-built integrations with Salesforce, Jira, Slack, and 1,200+ tools via the Zendesk Marketplace.',
        category: 'Integrations',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'BEHIND',
        prosText: '• 1,200+ marketplace apps cover virtually every enterprise tech stack configuration\n• Partner-built integrations receive Zendesk certification and security review, reducing procurement risk\n• Marketplace ecosystem creates strong lock-in — integration dependencies make migration costly',
        consText: '• Many marketplace apps are community-maintained with inconsistent quality and support responsiveness\n• Deep bidirectional integrations (e.g., full Salesforce sync) typically require custom implementation work beyond the app\n• App conflicts are a known issue — running multiple integrations can cause unpredictable ticket routing behavior',
        marketSentimentText: 'Zendesk leads marketplace messaging with the "works with everything" positioning, using integration breadth as a lock-in and ecosystem moat argument. In competitive deals against point solutions, they consistently leverage the integration story to raise switching cost concerns and highlight consolidation value.',
      },
    }),
  ])

  // Competitor Features — Intercom
  const intercomFeatures = await Promise.all([
    prisma.competitorFeature.create({
      data: {
        competitorId: intercom.id,
        name: 'Fin AI Chatbot',
        description: 'GPT-4 powered conversational bot available 24/7 across web, mobile, and email with multilingual support.',
        category: 'AI',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'BEHIND',
        prosText: '• Native multilingual support across 45 languages without separate knowledge base instances\n• 24/7 availability with consistent response quality independent of agent staffing levels\n• Deep integration with Intercom\'s own CRM and conversation history enables personalized, context-aware responses',
        consText: '• Heavily tied to the Intercom platform — customers on other helpdesks cannot access Fin without migrating\n• Pricing is consumption-based per resolution, which creates unpredictable costs at scale\n• Fin\'s confidence in low-volume or niche topic areas drops sharply — there is no graceful fallback mode by default',
        marketSentimentText: 'Intercom markets Fin as "the AI agent built on the world\'s most advanced conversational platform," leveraging their decade of messaging data as a moat argument. Pricing on a per-resolution basis is positioned as a performance guarantee — you only pay when it works — which is an effective objection handler for risk-averse buyers.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: intercom.id,
        name: 'Product Tours',
        description: 'In-app step-by-step walkthroughs triggered by user behavior to drive feature adoption and reduce support load.',
        category: 'Engagement',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'NO_MATCH',
        prosText: '• Behavioral triggers enable tours to fire at the exact moment of user confusion, maximizing completion rates\n• No-code tour builder is accessible to CS and product teams without engineering involvement\n• Tour analytics tie completion rates to downstream activation metrics, making ROI measurable',
        consText: '• Tours require ongoing maintenance as product UI changes — abandoned tours create frustrating user experiences\n• Trigger logic can be complex to configure correctly for teams without CRM/behavioral event instrumentation\n• Tours can feel patronizing if over-deployed — aggressive use can increase churn rather than reduce support load',
        marketSentimentText: 'Intercom positions Product Tours as the proactive support tool that prevents tickets from being created in the first place, tying it to a "shift-left" support philosophy. It is marketed as a product and CS team collaboration tool, which broadens the buying committee and strengthens their platform consolidation narrative.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: intercom.id,
        name: 'Series (Visual Workflow Builder)',
        description: 'Drag-and-drop automation builder for multi-step customer journeys combining messages, bots, and conditionals.',
        category: 'Automation',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'NO_MATCH',
        prosText: '• Visual canvas makes complex multi-step automation comprehensible to non-technical CX operators\n• AI branching conditions (added 2024) enable sentiment- and intent-based routing without code\n• Pre-built templates for common journeys (onboarding, churn prevention) dramatically reduce time-to-deploy',
        consText: '• Complex workflows become visually unwieldy at scale — large Series diagrams are difficult to audit and maintain\n• No version control or staging environment for workflows — testing changes in production creates risk\n• Series is Intercom-ecosystem-only; there is no API to trigger Series workflows from external systems without webhooks',
        marketSentimentText: 'Intercom markets Series as the "journey orchestration layer" that transforms their platform from a support tool into a full lifecycle engagement system. The visual metaphor is central to their positioning — they consistently demonstrate Series in live demos as proof that non-engineers can build sophisticated automation.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: intercom.id,
        name: 'Unified Inbox',
        description: 'Single inbox for conversations across email, chat, WhatsApp, SMS, and social with AI triage and assignment rules.',
        category: 'Productivity',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        prosText: '• True omnichannel inbox with native WhatsApp and SMS reduces agent tool-switching significantly\n• AI triage at inbox level automatically assigns priority and team based on conversation content\n• Team inbox views and conversation assignments are real-time, enabling effective queue management',
        consText: '• Social channel support (Twitter/X, Facebook) lags behind dedicated social CRM tools in threading and context\n• Inbox performance degrades at very high conversation volumes — enterprise customers with 50k+ monthly conversations report latency issues\n• No built-in SLA management — teams must configure manual rules to approximate SLA tracking',
        marketSentimentText: 'Intercom positions the Unified Inbox as the center of their "one platform for all customer communication" story, emphasizing that fragmented inboxes create fragmented customer experiences. They routinely challenge Zendesk in competitive deals by arguing their inbox is designed for conversation rather than ticket management.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: intercom.id,
        name: 'Help Center',
        description: 'Hosted knowledge base with AI-assisted article creation, multilingual support, and reader analytics.',
        category: 'Self-Service',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        prosText: '• AI-assisted article drafting from conversation history dramatically reduces KB authoring time\n• Multilingual article management with translation workflow built in natively\n• Reader analytics surface which articles are most consulted and where readers abandon, enabling targeted improvements',
        consText: '• Help Center customization for brand alignment is limited compared to dedicated KB tools like Helpjuice or Guru\n• No built-in article review/approval workflow — teams with compliance requirements need external process overhead\n• SEO capabilities are basic; external organic search traffic acquisition is limited compared to standalone KB platforms',
        marketSentimentText: 'Intercom markets Help Center as the knowledge layer that feeds both self-service and AI resolution, positioning it as more valuable when combined with Fin. Their messaging increasingly frames Help Center as an AI training asset — good articles make the AI better — creating a content quality flywheel narrative.',
      },
    }),
  ])

  // Competitor Features — Gorgias
  const gorgiasFeatures = await Promise.all([
    prisma.competitorFeature.create({
      data: {
        competitorId: gorgias.id,
        name: 'AI Automate',
        description: 'Automatically resolves repetitive e-commerce tickets (order status, returns, tracking) without agent intervention using Shopify data.',
        category: 'Automation',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        roadmapImplicationText: 'Gorgias integrates directly with Shopify order data for auto-resolution. This is a strong moat for e-commerce customers we don\'t address.',
        prosText: '• Native Shopify data access enables true resolution actions (not just answers) — AI can trigger refunds, cancellations, and reorders\n• 30% deflection rate out of the box for e-commerce ticket patterns is significantly above industry baseline\n• GA release includes pre-built automation flows for the top 10 e-commerce intent patterns requiring zero configuration',
        consText: '• Automation scope is narrowly tuned to e-commerce intents — non-product support (billing, account) requires separate configuration\n• Shopify-first architecture means BigCommerce and WooCommerce customers get meaningfully reduced functionality\n• Auto-resolution actions lack rollback mechanisms — errors (incorrect refunds, duplicate cancellations) require manual remediation',
        marketSentimentText: 'Gorgias markets AI Automate as "the first AI agent that can actually do things in your store," positioning the action capability (not just answers) as the primary differentiator. They lean heavily on the 30% deflection benchmark in all launch materials and use it as a baseline guarantee in enterprise sales conversations.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: gorgias.id,
        name: 'Intent Detection',
        description: 'ML model trained on e-commerce ticket patterns to classify intent (WISMO, refund, cancellation) with 95%+ accuracy.',
        category: 'AI',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        prosText: '• 95%+ accuracy on e-commerce intents is validated across a large multi-merchant training corpus\n• Pre-trained model is production-ready on day one for e-commerce teams without custom configuration\n• Intent signals feed directly into routing, macros, and automation triggers creating a coherent automation stack',
        consText: '• Model is exclusively trained on e-commerce intent patterns — poor generalization to SaaS, healthcare, or B2B support\n• Custom intent categories require professional services engagement — not self-serve\n• Confidence scores are not exposed to customers, making it difficult to tune automation thresholds independently',
        marketSentimentText: 'Gorgias frames Intent Detection as the "e-commerce trained brain" that generic AI platforms cannot match because they lack the domain-specific training data. This specialization argument is central to their competitive positioning against Zendesk and Intercom in DTC and e-commerce accounts.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: gorgias.id,
        name: 'Revenue Statistics',
        description: 'Ties each support interaction to revenue impact — tracks which conversations led to purchases, upsells, or churn prevention.',
        category: 'Analytics',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'NO_MATCH',
        roadmapImplicationText: 'This is a unique differentiator for e-commerce. Revenue attribution for support is a gap in our analytics story.',
        prosText: '• Revenue attribution reframes support from a cost center to a revenue driver in board-level conversations\n• Shopify order linkage is automatic — no custom attribution logic or UTM tracking setup needed\n• Per-agent and per-channel revenue attribution enables data-driven team investment decisions',
        consText: '• Attribution model is last-touch, which overstates support contribution for customers with multi-touch journeys\n• Revenue statistics are Shopify-dependent — non-Shopify merchants see incomplete or unavailable attribution data\n• No ability to customize the attribution window — fixed 7-day conversion window may not suit all business models',
        marketSentimentText: 'Gorgias leads all brand and product marketing with Revenue Statistics, using it to fundamentally reposition support from overhead to growth lever. Their tagline "support that drives revenue" directly references this feature and is designed to shift the buyer from CX director to CMO and CFO in enterprise sales cycles.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: gorgias.id,
        name: 'Shopify Deep Integration',
        description: 'Native Shopify sidebar in ticket view showing order history, tags, LTV, and one-click refund/cancel/reorder actions.',
        category: 'Integrations',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'NO_MATCH',
        prosText: '• One-click refund and cancel actions directly from the ticket view eliminate tab-switching for agents\n• LTV and order history in sidebar enables agents to make value-based decisions (e.g., waive policy for high-LTV customers)\n• Native Shopify app listing means setup takes under 30 minutes for most merchants',
        consText: '• Deep Shopify coupling creates significant lock-in — migration to another helpdesk is painful and data-lossy\n• Real-time Shopify data sync can lag by several minutes during peak traffic periods, causing agents to act on stale order data\n• Integration is read-write, which creates compliance concerns for enterprises with strict change management policies',
        marketSentimentText: 'Gorgias markets Shopify Deep Integration as the proof point that Gorgias was "built for e-commerce, not adapted for it," using the native sidebar as a visual demonstration of depth that generic helpdesks cannot replicate. It anchors their conference and event presence in the Shopify ecosystem.',
      },
    }),
    prisma.competitorFeature.create({
      data: {
        competitorId: gorgias.id,
        name: 'Macros & Rules Engine',
        description: 'Advanced macro system with dynamic variables, conditional logic, and multi-step actions triggered by ticket attributes.',
        category: 'Productivity',
        enrichmentStatus: 'ENRICHED',
        matchStatus: 'PARTIAL',
        prosText: '• Dynamic variables pull live Shopify data into macro responses, enabling personalized automated replies at scale\n• Conditional logic in rules engine handles complex multi-step scenarios without code\n• Multi-step actions (tag + assign + reply in one macro) compress agent workflow from several steps to one',
        consText: '• Rules engine lacks a visual builder — complex rule trees must be configured through a text-heavy interface\n• No conflict detection when multiple rules target the same ticket — rule order dependency creates brittle configurations\n• Macro library grows unwieldy at scale without governance tooling — large teams accumulate hundreds of unmaintained macros',
        marketSentimentText: 'Gorgias positions Macros & Rules Engine as the productivity multiplier that lets small CX teams handle e-commerce volumes without headcount growth. It is a core feature in their ROI pitch to founders and ops leads, frequently framed as the difference between a 2-person and 10-person support team handling the same ticket volume.',
      },
    }),
  ])

  // Source Evidence
  await Promise.all([
    // Fin — Conversational AI Resolution (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: finFeatures[0].id,
        url: 'https://www.intercom.com/fin',
        title: 'Fin AI — Intercom',
        snippet: 'Fin resolves up to 51% of your support volume instantly using GPT-4 reasoning over your knowledge base.',
        confidence: 0.95,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: finFeatures[0].id,
        url: 'https://www.intercom.com/blog/announcing-fin',
        title: 'Announcing Fin: The AI bot that actually works',
        snippet: 'Unlike traditional bots, Fin doesn\'t need to be trained. It reads your help center and uses reasoning to answer questions.',
        confidence: 0.9,
      },
    }),
    // Fin — Smart Handoff to Agents (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: finFeatures[1].id,
        url: 'https://www.intercom.com/help/en/articles/8205718-how-fin-hands-off-to-your-team',
        title: 'How Fin hands off conversations to your team — Intercom',
        snippet: 'When Fin hands off a conversation, the agent receives a summary of what was discussed, the customer\'s sentiment, and suggested next steps — so they can pick up seamlessly.',
        confidence: 0.88,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: finFeatures[1].id,
        url: 'https://www.intercom.com/blog/ai-human-handoff-best-practices',
        title: 'Best practices for AI-to-human handoff in customer support — Intercom Blog',
        snippet: 'Customers who experience a smooth AI-to-human handoff rate their support experience 22% higher than those who have to repeat their issue to a human agent.',
        confidence: 0.82,
      },
    }),
    // Fin — Fin Insights (1 source)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: finFeatures[3].id,
        url: 'https://www.intercom.com/help/en/articles/8356552-fin-ai-insights',
        title: 'Fin AI Insights — Intercom Help Center',
        snippet: 'Fin Insights surfaces unanswered question clusters, resolution trends, and content gap recommendations to help you continuously improve Fin\'s performance.',
        confidence: 0.87,
      },
    }),
    // Zendesk — AI Copilot (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: zendeskFeatures[0].id,
        url: 'https://www.zendesk.com/platform/ai/',
        title: 'Zendesk AI — Agent Copilot Overview',
        snippet: 'Zendesk AI Copilot proactively makes recommendations and takes actions to help agents work more efficiently.',
        confidence: 0.9,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: zendeskFeatures[0].id,
        url: 'https://www.zendesk.com/newsroom/press-releases/zendesk-ai-copilot-ga/',
        title: 'Zendesk AI Copilot is Now Generally Available',
        snippet: 'Zendesk AI Copilot, now GA, helps agents draft replies, find relevant macros, and surface knowledge — all before the agent types a single word. Early customers report 28% AHT reduction.',
        confidence: 0.93,
      },
    }),
    // Zendesk — Advanced Analytics Suite (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: zendeskFeatures[1].id,
        url: 'https://www.zendesk.com/service/reporting-analytics/explore/',
        title: 'Zendesk Explore — Advanced Analytics',
        snippet: 'Zendesk Explore gives you deep insight into your customer support with pre-built and custom dashboards, predictive CSAT, and SLA performance heatmaps.',
        confidence: 0.91,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: zendeskFeatures[1].id,
        url: 'https://support.zendesk.com/hc/en-us/articles/4408832171290-Zendesk-Explore-overview',
        title: 'Zendesk Explore overview — Zendesk Support',
        snippet: 'Explore allows you to build custom queries, create calculated metrics, and share live dashboards with stakeholders — all without requiring a separate analytics platform.',
        confidence: 0.88,
      },
    }),
    // Forethought — Triage AI (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: forethoughtFeatures[0].id,
        url: 'https://forethought.ai/products/triage/',
        title: 'Forethought Triage AI',
        snippet: 'Triage AI automatically routes tickets with 90%+ accuracy using intent models trained on your historical data.',
        confidence: 0.88,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: forethoughtFeatures[0].id,
        url: 'https://forethought.ai/blog/ai-ticket-routing-vs-rule-based-routing',
        title: 'AI Ticket Routing vs. Rule-Based Routing — Forethought Blog',
        snippet: 'Teams using AI-based routing spend 80% less time on routing configuration and see 35% fewer misrouted tickets compared to rule-based systems, based on analysis of 200+ Forethought customers.',
        confidence: 0.83,
      },
    }),
    // Forethought — Deflect AI (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: forethoughtFeatures[1].id,
        url: 'https://forethought.ai/products/deflect/',
        title: 'Forethought Deflect AI — Pre-Submission Ticket Deflection',
        snippet: 'Deflect AI surfaces relevant articles as customers type, intercepting tickets before they are submitted. Customers report 20-35% deflection rate improvements within the first 30 days.',
        confidence: 0.87,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: forethoughtFeatures[1].id,
        url: 'https://forethought.ai/resources/case-study-taskus-deflection',
        title: 'How TaskUs Reduced Ticket Volume by 28% with Forethought Deflect',
        snippet: 'By implementing pre-submission article surfacing, TaskUs deflected 28% of incoming ticket volume in the first quarter, freeing agents to focus on complex issues requiring human judgment.',
        confidence: 0.79,
      },
    }),
    // Gorgias — Revenue Statistics (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: gorgiasFeatures[2].id,
        url: 'https://www.gorgias.com/features/revenue-statistics',
        title: 'Gorgias Revenue Statistics',
        snippet: 'See the direct revenue impact of your support team — track conversions, upsells, and retention driven by support interactions.',
        confidence: 0.92,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: gorgiasFeatures[2].id,
        url: 'https://www.gorgias.com/blog/support-revenue-attribution',
        title: 'How to Measure the Revenue Your Support Team Drives — Gorgias Blog',
        snippet: 'Gorgias customers using Revenue Statistics discover on average that support interactions influence 15-25% of total store revenue — a figure invisible to teams using traditional helpdesk analytics.',
        confidence: 0.85,
      },
    }),
    // Gorgias — AI Automate (2 sources)
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: gorgiasFeatures[0].id,
        url: 'https://www.gorgias.com/features/automate',
        title: 'Gorgias AI Automate — Automated Ticket Resolution',
        snippet: 'Gorgias AI Automate resolves repetitive e-commerce tickets automatically. Early customers report 30% ticket deflection within the first two weeks of deployment.',
        confidence: 0.93,
      },
    }),
    prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: gorgiasFeatures[0].id,
        url: 'https://www.gorgias.com/blog/ai-automate-ga',
        title: 'Gorgias AI Automate is now generally available',
        snippet: 'With GA, AI Automate now handles order status, return requests, and shipment tracking queries end-to-end — including triggering actual Shopify actions — without any agent involvement.',
        confidence: 0.9,
      },
    }),
  ])

  // Key Updates
  await Promise.all([
    prisma.competitorKeyUpdate.create({
      data: {
        competitorId: fin.id,
        updateType: 'ENHANCEMENT',
        title: 'Fin upgraded to GPT-4o with 40% lower latency',
        diffSummaryText: 'Intercom upgraded Fin from GPT-4 to GPT-4o, reducing median response time from 4.2s to 2.5s and improving resolution accuracy on ambiguous queries.',
        description: 'Fin is now benchmarking ahead of us on response speed in third-party evaluations. Any prospect running a bake-off will see this gap immediately — we need a latency improvement story or a counter-narrative about accuracy vs. speed tradeoffs before the next evaluation cycle.',
        pmActionStatus: 'IN_REVIEW',
        detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.competitorKeyUpdate.create({
      data: {
        competitorId: fin.id,
        updateType: 'NEW_FEATURE',
        title: 'Fin now supports 45 languages natively',
        diffSummaryText: 'Fin added multilingual support for 45 languages without requiring separate knowledge bases — it auto-detects customer language and responds accordingly.',
        description: 'EMEA expansion is a strategic priority for most enterprise buyers. Fin\'s native multilingual support removes a major objection we previously had parity on. We need to assess whether our language coverage is competitive and whether we can match the auto-detect approach, or position our per-locale knowledge bases as a quality advantage.',
        pmActionStatus: 'PENDING',
        detectedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.competitorKeyUpdate.create({
      data: {
        competitorId: zendesk.id,
        updateType: 'NEW_FEATURE',
        title: 'Zendesk AI Copilot GA — now includes auto-draft',
        diffSummaryText: 'Zendesk AI Copilot exited beta and is now GA. New auto-draft feature generates a complete reply draft before the agent even opens the ticket.',
        description: 'Auto-draft is a highly visible UX win — agents perceive it as immediate productivity. We are still in beta for equivalent functionality. Zendesk will now use this in every competitive demo. We should evaluate accelerating our agent-assist GA date and ensure our positioning emphasizes draft quality, not just draft speed.',
        pmActionStatus: 'IN_REVIEW',
        detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.competitorKeyUpdate.create({
      data: {
        competitorId: zendesk.id,
        updateType: 'PRICING_CHANGE',
        title: 'Zendesk raised Suite Professional price by 15%',
        diffSummaryText: 'Zendesk increased pricing for Suite Professional from $115 to $132/agent/month, citing AI feature additions. Potentially creates opening for competitive displacement.',
        description: 'Zendesk renewals in Q2 and Q3 are now an active displacement opportunity. Accounts renewing at the new rate will be receptive to competitive conversations. Sales should proactively reach out to known Zendesk accounts 90 days before their renewal date with a cost-comparison pitch anchored on our AI-inclusive pricing.',
        pmActionStatus: 'PENDING',
        detectedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.competitorKeyUpdate.create({
      data: {
        competitorId: forethought.id,
        updateType: 'NEW_FEATURE',
        title: 'Forethought launched Solve for Salesforce',
        diffSummaryText: 'Forethought released a native Salesforce Service Cloud integration for their Solve autonomous AI product, expanding beyond Zendesk-only deployments.',
        description: 'Forethought is no longer a Zendesk-only play. They can now appear in Salesforce Service Cloud deals, where we have historically had little competition from AI-first vendors. This materially increases Forethought\'s addressable market and means we may start encountering them in mid-market Salesforce accounts we considered relatively safe.',
        pmActionStatus: 'PENDING',
        detectedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.competitorKeyUpdate.create({
      data: {
        competitorId: intercom.id,
        updateType: 'ENHANCEMENT',
        title: 'Intercom Series builder now supports AI branching',
        diffSummaryText: 'The visual workflow builder (Series) added AI-powered branch conditions — workflows can now branch based on sentiment, intent, or Fin\'s confidence score.',
        description: 'AI-powered branching lowers the technical barrier for mid-market buyers to build sophisticated automation without writing code or calling APIs. This is a significant mid-market expansion signal — Intercom is moving upmarket by making enterprise-grade capabilities accessible to ops teams without engineering support. Watch for increased win-rate erosion in 200–1000 seat accounts.',
        pmActionStatus: 'DISMISSED',
        detectedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.competitorKeyUpdate.create({
      data: {
        competitorId: gorgias.id,
        updateType: 'NEW_FEATURE',
        title: 'Gorgias AI Automate exits beta — now resolves 30% of tickets',
        diffSummaryText: 'Gorgias AI Automate is now GA, handling order status, returns, and tracking queries automatically. Early customers report 30% ticket deflection within 2 weeks.',
        description: 'Gorgias now has a credible AI automation story purpose-built for e-commerce, with Shopify-native integrations we lack. Any prospect in DTC or e-commerce will evaluate Gorgias first. We need a dedicated e-commerce vertical narrative that highlights our advantages in complex escalation handling and multi-brand account management — areas where Gorgias is weaker.',
        pmActionStatus: 'IN_REVIEW',
        detectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  // Battle Cards (1 per competitor)
  await prisma.battleCard.create({
    data: {
      organizationId: org.id,
      title: 'vs Forethought',
      competitors: { connect: [{ id: forethought.id }] },
      strengthsText: '• AcmeSupport AI combines triage, deflection, agent assist, and analytics in a single unified product — no multi-module pricing complexity\n• Our intent model is fine-tunable by customers without professional services — Forethought requires PS engagement for custom taxonomies\n• AcmeSupport AI exposes confidence scores and routing rationale, giving ops teams full auditability that Forethought\'s black-box model lacks',
      weaknessesText: '• Forethought\'s autonomous Solve product handles true end-to-end resolution for defined intents — our autonomous resolution capability is not yet GA\n• Their Insights Dashboard includes AI-narrated ROI summaries we do not yet offer — a gap in exec-level reporting storytelling',
      differentiatorsText: '• Transparent, auditable AI routing with customer-configurable confidence thresholds — Forethought offers neither\n• Unified platform pricing eliminates the per-module cost structure that makes Forethought expensive to expand\n• Real-time pre-submission deflection and post-submission assist in the same product — Forethought sells these as separate SKUs',
      salesMessagingText: '"Forethought requires professional services to customize intent categories" → AcmeSupport AI gives your team direct access to intent configuration and threshold tuning — no PS contract, no waiting. You own your AI.',
      pmTakeawaysText: '• Prioritize GA of autonomous resolution to close the Solve parity gap — this is the most common blocker in Forethought competitive deals\n• Build AI-narrated analytics summaries (plain-language ROI readouts) to match Forethought Insights for exec audiences\n• Invest in confidence score transparency and routing audit trail UI — this is a consistent win theme in head-to-head evaluations',
      contentMd: `## vs Forethought\n\n### What They Do Well\nForethought is AI-native from the ground up, with a compelling story around zero-configuration triage and a clear product ladder from triage to deflection to autonomous resolution. Their Solve product is genuinely ahead of most competitors on end-to-end autonomous ticket resolution for defined intents, and their Insights Dashboard with AI-narrated summaries is a differentiator in exec-level conversations.\n\n### Where We Win\nAcmeSupport AI wins on transparency and customer control. Our auditable routing rationale, customer-configurable intent thresholds, and self-serve taxonomy customization address the top operational objections that surface in Forethought evaluations: black-box routing decisions and PS-dependent customization. We also win on total cost of ownership — our unified platform pricing avoids the per-module expansion cost that catches Forethought customers off guard at renewal.\n\n### Strategic Watch\nForethought's Salesforce integration expansion is a meaningful threat to our mid-market and enterprise pipeline. Watch for them to accelerate CRM-native positioning. Their upcoming agentic roadmap (multi-step action flows) would close the gap between Solve and a true autonomous support agent — monitor quarterly release notes closely.`,
    },
  })

  await prisma.battleCard.create({
    data: {
      organizationId: org.id,
      title: 'vs Fin by Intercom',
      competitors: { connect: [{ id: fin.id }] },
      strengthsText: '• AcmeSupport AI is platform-agnostic — Fin only works within Intercom\'s own inbox, forcing customers to migrate their entire support stack\n• Our per-seat pricing model is predictable at scale — Fin\'s per-resolution pricing creates budget risk for high-volume teams\n• AcmeSupport AI works alongside any existing ticketing system (Zendesk, Freshdesk, Salesforce) without a rip-and-replace migration',
      weaknessesText: '• Fin\'s 51% resolution benchmark is the highest published in the industry — we need to close this performance gap and publish our own benchmark\n• Intercom\'s native multilingual support across 45 languages is ahead of our current language coverage',
      differentiatorsText: '• Bring-your-own-helpdesk architecture — integrate with your existing tools rather than being forced into Intercom\'s ecosystem\n• Predictable per-seat pricing vs. Fin\'s variable per-resolution model — no surprise invoices during traffic spikes\n• Cross-channel intelligence applied across ticketing, chat, and email simultaneously — Fin is chat-first',
      salesMessagingText: '"We\'re already on Zendesk and can\'t move" → AcmeSupport AI is designed to augment your existing stack. You get AI resolution rates competitive with Fin without abandoning your Zendesk investment or migrating your entire workflow.',
      pmTakeawaysText: '• Publish a resolution rate benchmark study — the 51% number is Fin\'s primary sales weapon and we need a credible counter-narrative with our own data\n• Expand language support to close the 45-language gap — multilingual is a consistent ask in EMEA and LATAM pipeline\n• Build a Fin-to-AcmeSupport migration guide — the "I\'m locked into Intercom" objection is addressable if we reduce perceived migration friction',
      contentMd: `## vs Fin by Intercom\n\n### What They Do Well\nFin is the most capable pure-AI resolution product on the market for teams already on Intercom. The 51% resolution rate, GPT-4o upgrade, and 45-language support make it a compelling offering for Intercom-native customers. Their per-resolution pricing creates a "you only pay when it works" narrative that is highly effective with risk-averse buyers evaluating AI for the first time.\n\n### Where We Win\nOur strongest win theme against Fin is platform independence. Every Fin deal requires a customer to adopt or remain on Intercom's inbox — a full stack decision, not a point solution evaluation. AcmeSupport AI deploys on top of existing Zendesk, Freshdesk, or Salesforce investments in days. We also win on pricing predictability: Fin's per-resolution model creates unpredictable costs for teams with variable ticket volumes, while our per-seat model gives finance teams a clean budget number.\n\n### Strategic Watch\nIntercom is pushing Fin aggressively into the enterprise segment with SOC 2, HIPAA, and custom data residency options. If they close the compliance gap, their platform breadth becomes a much harder story to compete against. Additionally, the GPT-4o upgrade improving latency to 2.5s sets a new user experience bar — our response latency needs to match or beat this in product benchmarks.`,
    },
  })

  await prisma.battleCard.create({
    data: {
      organizationId: org.id,
      title: 'vs Zendesk',
      competitors: { connect: [{ id: zendesk.id }] },
      strengthsText: '• AcmeSupport AI is AI-first — every feature is built around intelligence from the ground up, whereas Zendesk AI is bolted onto a legacy ticketing architecture\n• We deploy and show value in days, not the weeks-to-months implementation timeline typical of Zendesk enterprise deployments\n• Our pricing is significantly more accessible — Zendesk Suite Professional at $132/agent/month after their 15% increase creates a compelling displacement opportunity',
      weaknessesText: '• Zendesk\'s 1,200+ marketplace integrations are an ecosystem moat we cannot replicate — enterprise accounts with deep integration dependencies are difficult to displace\n• Zendesk\'s Advanced Analytics (Explore) is more mature than our current analytics offering for enterprise reporting and compliance use cases',
      differentiatorsText: '• AI-native architecture means every new AI capability we build compounds naturally — Zendesk AI is additive, not foundational\n• Faster time-to-value: typical customer goes live in under 2 weeks vs. 6-12 weeks for Zendesk enterprise onboarding\n• Pricing disruption: our total cost of ownership is 40-60% lower than Zendesk Suite for mid-market teams (100-500 agents)',
      salesMessagingText: '"We\'ve been on Zendesk for 5 years" → We integrate with Zendesk — you don\'t have to choose. Add AcmeSupport AI\'s intelligence layer on top of your existing Zendesk data and workflows. When you\'re ready to migrate fully, we make it seamless.',
      pmTakeawaysText: '• Build a "Zendesk AI layer" positioning — market AcmeSupport AI as the AI upgrade for Zendesk customers, not a replacement (Trojan horse strategy)\n• Prioritize Advanced Analytics parity for enterprise reporting — this is the most common reason we lose Zendesk enterprise deals\n• Develop a comprehensive Zendesk migration toolkit (data export, configuration migration) to reduce the friction of full platform migration for expansion accounts',
      contentMd: `## vs Zendesk\n\n### What They Do Well\nZendesk is the default enterprise choice for a reason: their platform breadth, 1,200+ integrations, compliance certifications, and brand recognition create enormous switching costs. Their AI Copilot GA with auto-draft is a meaningful product improvement, and their Advanced Analytics suite (Explore) remains the most capable reporting layer in the market for large enterprise CX teams. The 15% price increase creates short-term pain but also validates the AI value story they are building.\n\n### Where We Win\nWe win on AI depth and speed-to-value. AcmeSupport AI's resolution rates, routing accuracy, and deflection metrics outperform Zendesk AI Copilot in side-by-side evaluations — because AI is our core product, not a feature layer. We also win consistently on implementation timeline (days vs. months) and total cost, especially post-Zendesk price increase. Our strongest deals are mid-market teams (50-500 agents) who are paying Zendesk enterprise pricing for features they don't fully use.\n\n### Strategic Watch\nZendesk's pricing increase is a double-edged sword — it opens displacement opportunities but also signals they are confident enough in their AI value story to test price elasticity. Watch for their next AI roadmap announcement closely; if they close the resolution rate gap, their ecosystem moat becomes the dominant competitive dynamic. Their Marketplace is also an active threat — every new integration they add raises the switching cost for existing customers.`,
    },
  })

  await prisma.battleCard.create({
    data: {
      organizationId: org.id,
      title: 'vs Intercom',
      competitors: { connect: [{ id: intercom.id }] },
      strengthsText: '• AcmeSupport AI is purpose-built for support resolution — Intercom is a broad engagement platform where support is one of many use cases, creating feature depth trade-offs\n• Our agent workspace is optimized for high-volume support operations — Intercom\'s inbox is designed for conversational engagement, not ticket queue management\n• We offer deeper CRM and ticketing system integrations out of the box — Intercom positions their own inbox as the destination, creating friction with existing tool investments',
      weaknessesText: '• Intercom\'s platform breadth (tours, push messages, in-app banners, lifecycle messaging) serves a wider buying committee — we are a narrower product sale\n• Their Series visual workflow builder and lifecycle automation capabilities have no equivalent in our product — relevant for prospects seeking a single CX platform',
      differentiatorsText: '• Support-specialized AI that outperforms generalist engagement AI on resolution rate, routing accuracy, and CSAT improvement\n• No platform migration required — AcmeSupport AI works alongside existing messaging and CRM tools rather than replacing them\n• Support ops-optimized interface with SLA management, queue views, and bulk actions — built for the support manager, not the growth marketer',
      salesMessagingText: '"We use Intercom for everything" → Keep using Intercom for lifecycle messaging and engagement. AcmeSupport AI plugs directly into your support queue and makes your agents dramatically more effective — without touching your existing Intercom setup.',
      pmTakeawaysText: '• Lean into the "support specialist" positioning — our depth in resolution quality, SLA management, and support analytics is the core differentiation vs. Intercom\'s generalist approach\n• Consider a native Intercom integration (read inbox, write resolutions) to enable a coexistence story rather than a displacement story\n• Monitor Intercom\'s pricing model evolution — their per-resolution Fin pricing may expand to other features, creating budget predictability concerns we can exploit',
      contentMd: `## vs Intercom\n\n### What They Do Well\nIntercom has built the most complete customer engagement platform in the market. Series, Product Tours, Fin, and the Unified Inbox form a coherent lifecycle story that appeals to companies looking to consolidate their entire customer communication stack. Their recent AI branching in Series is genuinely innovative, and their design quality sets a high bar for UX expectations in the market.\n\n### Where We Win\nWe win when the buyer is a Support Director or VP of CX rather than a CMO or Head of Growth. Our product is deeper on the dimensions that matter to support operations: resolution rate, SLA management, agent productivity, and support-specific analytics. In head-to-head evaluations for support use cases, we consistently outperform Intercom on the metrics support leaders are measured on. We also win on the "no migration required" argument — AcmeSupport AI layers on top of existing tools, while Intercom wants to be your single platform of record.\n\n### Strategic Watch\nIntercom's AI branching in Series combined with Fin's resolution capabilities is converging toward an autonomous support orchestration story. If they execute well, the boundary between "engagement platform" and "support AI platform" blurs significantly. Watch for Intercom to reposition Fin more aggressively as a standalone product with its own pricing tier — that would put them in direct competition with our core market.`,
    },
  })

  await prisma.battleCard.create({
    data: {
      organizationId: org.id,
      title: 'vs Gorgias',
      competitors: { connect: [{ id: gorgias.id }] },
      strengthsText: '• AcmeSupport AI serves all verticals — Gorgias is deeply specialized for e-commerce, making them a poor fit for SaaS, healthcare, or B2B accounts\n• Our analytics go beyond revenue attribution to include CSAT prediction, agent performance, and SLA heatmaps — a broader value story for non-e-commerce buyers\n• Our AI is trained across industries — Gorgias intent models degrade significantly outside e-commerce ticket patterns',
      weaknessesText: '• Gorgias\'s Shopify integration depth and revenue attribution are unique moats in DTC and e-commerce accounts — we cannot credibly compete for Shopify-native e-commerce teams\n• Their 30% deflection benchmark for e-commerce intents and native action capabilities (refunds, cancellations) are genuine differentiators we lack',
      differentiatorsText: '• Vertical-agnostic AI that performs equally well for SaaS, fintech, healthcare, and e-commerce support use cases\n• No platform dependency — works with any commerce platform (Shopify, Salesforce Commerce, custom), not just Shopify/BigCommerce\n• CSAT prediction and advanced SLA management built in — Gorgias lacks proactive quality management tools',
      salesMessagingText: '"We\'re on Shopify and considering Gorgias" → If your primary pain is WISMO and returns volume, Gorgias is genuinely strong. If you also need CSAT management, SLA compliance, and support quality analytics — or if you\'ll ever sell through channels beyond Shopify — AcmeSupport AI is the platform that scales with you.',
      pmTakeawaysText: '• Do not compete head-to-head for pure Shopify DTC accounts — qualify hard for multi-channel, multi-platform, or non-e-commerce revenue mix before investing sales cycles\n• Build a basic Shopify integration to neutralize the "Gorgias does Shopify natively" objection in mixed-platform accounts\n• Invest in e-commerce intent detection and order status automation to close the most common e-commerce support use case gap — even a basic WISMO automation expands our addressable market significantly',
      contentMd: `## vs Gorgias\n\n### What They Do Well\nGorgias has built a genuinely defensible product for Shopify-native e-commerce brands. Their revenue attribution, native Shopify actions, and e-commerce-trained intent model are category-defining capabilities that no other helpdesk can match at their depth. The 30% deflection benchmark for e-commerce intents and their "support drives revenue" positioning have meaningfully shifted how DTC brands think about support ROI.\n\n### Where We Win\nWe win outside the Shopify DTC core. Any account with significant SaaS, B2B, or non-Shopify commerce revenue quickly finds Gorgias's model limitations. We also win on support quality management — our CSAT prediction, SLA heatmaps, and agent performance analytics have no equivalent in Gorgias, which matters to support operations leaders responsible for quality alongside volume. In multi-brand or omnichannel accounts, our platform-agnostic architecture is a clear advantage.\n\n### Strategic Watch\nGorgias is actively expanding beyond Shopify with BigCommerce and WooCommerce integrations, and their revenue attribution model is a format others will attempt to replicate. If they successfully broaden to a "commerce-agnostic" story, their vertical moat expands significantly. Also watch their AI Automate roadmap — extension into SaaS or subscription billing intents would bring them into our core competitive territory.`,
    },
  })

  // Roadmap Items (8)
  const roadmapItems = await Promise.all([
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'Predictive CSAT Scoring',
        description: 'AI model to predict CSAT score before ticket closure, enabling proactive intervention',
        sourceType: 'MANUAL',
        status: 'IN_PROGRESS',
        riceReach: 80, riceImpact: 9, riceConfidence: 70, riceEffort: 4,
        sortOrder: 1,
      },
    }),
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'Voice Channel Integration',
        description: 'Native voice support with AI transcription and sentiment analysis',
        sourceType: 'COMPETITOR_GAP',
        status: 'PLANNED',
        riceReach: 60, riceImpact: 8, riceConfidence: 80, riceEffort: 8,
        sortOrder: 2,
      },
    }),
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'Custom AI Model Training',
        description: 'Allow customers to fine-tune AI on their product documentation and past tickets',
        sourceType: 'ACCOUNT_FEEDBACK',
        status: 'PLANNED',
        riceReach: 40, riceImpact: 10, riceConfidence: 60, riceEffort: 12,
        sortOrder: 3,
      },
    }),
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'AI Summary for Long Threads (v2)',
        description: 'Improved summarization with key action items and customer mood tracking',
        sourceType: 'MANUAL',
        status: 'IDEA',
        sortOrder: 4,
      },
    }),
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'Multi-bot Orchestration',
        description: 'Route customer queries to specialized AI bots based on product area',
        sourceType: 'AI_GENERATED',
        status: 'IDEA',
        isAiSuggested: true,
        sortOrder: 5,
      },
    }),
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'Real-time Agent Coaching',
        description: 'Live suggestions and quality scoring as agents handle tickets',
        sourceType: 'ACCOUNT_FEEDBACK',
        status: 'IN_PROGRESS',
        riceReach: 90, riceImpact: 7, riceConfidence: 85, riceEffort: 6,
        sortOrder: 6,
      },
    }),
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'Proactive Outreach Engine',
        description: 'AI detects at-risk customers and triggers proactive support outreach',
        sourceType: 'AI_GENERATED',
        status: 'IDEA',
        isAiSuggested: true,
        sortOrder: 7,
      },
    }),
    (prisma.roadmapItem.create as any)({
      data: {
        productId: product.id,
        title: 'GDPR Data Erasure Automation',
        description: 'Automated data subject request handling with AI-powered data discovery',
        sourceType: 'MANUAL',
        status: 'PLANNED',
        riceReach: 50, riceImpact: 8, riceConfidence: 95, riceEffort: 5,
        sortOrder: 8,
      },
    }),
  ])

  // Specs (2)
  const spec1 = await (prisma.spec.create as any)({
    data: {
      roadmapItemId: roadmapItems[0].id,
      title: 'Predictive CSAT Scoring — Product Spec',
      version: 3,
      contentMd: `# Predictive CSAT Scoring

## Problem Statement
Support teams lose customers silently. By the time CSAT surveys arrive, the damage is done. AcmeSupport AI's Predictive CSAT module detects dissatisfaction signals in real-time, enabling agents to course-correct before the ticket closes.

## Goals & Success Metrics
- Predict CSAT score with ≥ 75% accuracy (measured against actual post-close surveys)
- Reduce low-CSAT tickets by 25% within 90 days of launch
- Agent adoption: ≥ 60% of agents act on at least 1 CSAT alert per week

## Solution Overview
A real-time ML pipeline analyzes ticket signals (response time, sentiment trajectory, escalations, reopens, message tone) and produces a CSAT risk score (0-100) visible to agents and team leads.

### Alert Thresholds
| Score | Status | Action |
|-------|--------|--------|
| 0-40 | 🔴 At Risk | Supervisor alert, AI coaching suggestion |
| 41-65 | 🟡 Watch | Agent nudge, suggested empathy phrases |
| 66-100 | 🟢 On Track | No action |

## Technical Requirements

### Model
- Fine-tuned classification model (BERT-based) on 12 months of historical tickets
- Inference via internal ML microservice (P99 latency < 50ms)
- Retrained monthly with new labeled data

### API Contract
\`\`\`typescript
POST /api/ml/csat-predict
{
  ticketId: string;
  signals: {
    responseTimeMs: number;
    reopenCount: number;
    sentimentTrajectory: number[]; // rolling 5-message window
    escalated: boolean;
  }
}
→ { score: number; confidence: number; factors: string[] }
\`\`\`

### UI Integration
- Agent sidebar: CSAT score badge with trend arrow
- Team lead dashboard: At-risk ticket queue
- Real-time update every 2 messages

## Acceptance Criteria
- [ ] CSAT prediction updates within 500ms of new message
- [ ] Alert triggers notification in agent sidebar
- [ ] Team lead can see all at-risk tickets in unified queue
- [ ] Model accuracy ≥ 75% on holdout test set
- [ ] Feature flag for gradual rollout

## Rollout Plan
1. Internal dogfooding (1 week)
2. Beta customers: Stripe, Shopify (2 weeks)
3. GA with feature flag (all customers)

## Open Questions
- Should we surface the score to end customers? (No, per privacy review)
- Retraining frequency: monthly vs. weekly?
`,
    },
  })

  // Spec Versions
  await (prisma as any).specVersion.createMany({
    data: [
      {
        specId: spec1.id,
        version: 1,
        contentMd: '# Predictive CSAT Scoring\n\nInitial draft — problem and goals only.',
        changedByUserId: adminUser.id,
        changeSummary: 'Initial draft',
      },
      {
        specId: spec1.id,
        version: 2,
        contentMd: '# Predictive CSAT Scoring\n\n## Problem Statement\nSupport teams lose customers silently...\n\n## Technical Requirements\nBasic ML model requirements added.',
        changedByUserId: pmUser.id,
        changeSummary: 'Added technical requirements',
      },
      {
        specId: spec1.id,
        version: 3,
        contentMd: (spec1 as any).contentMd,
        changedByUserId: pmUser.id,
        changeSummary: 'Full spec with API contract, rollout plan, and acceptance criteria',
      },
    ],
  })

  const spec2 = await (prisma.spec.create as any)({
    data: {
      roadmapItemId: roadmapItems[1].id,
      title: 'Voice Channel Integration — Product Spec',
      version: 1,
      contentMd: `# Voice Channel Integration

## Problem Statement
Customers increasingly want to call for complex issues. Zendesk has native voice; we don't. This is causing churn in enterprise accounts.

## Solution
Native VoIP integration with AI transcription, real-time sentiment, and automatic ticket creation from call.

## Key Features
- Inbound/outbound call management within the agent UI
- Real-time transcription (Whisper API)
- Automatic ticket creation with call summary
- Call recording with GDPR-compliant retention policies

## Acceptance Criteria
- [ ] Agents can receive calls without leaving the support dashboard
- [ ] Transcription accuracy ≥ 90% for English
- [ ] Call → ticket creation within 30 seconds of call end
`,
    },
  })

  await (prisma as any).specVersion.create({
    data: {
      specId: spec2.id, version: 1,
      contentMd: (spec2 as any).contentMd,
      changedByUserId: adminUser.id,
      changeSummary: 'Initial spec',
    },
  })

  // Link specs to roadmap items
  await Promise.all([
    (prisma.roadmapItem.update as any)({ where: { id: roadmapItems[0].id }, data: { specId: spec1.id } }),
    (prisma.roadmapItem.update as any)({ where: { id: roadmapItems[1].id }, data: { specId: spec2.id } }),
  ])

  // (Battle Cards created above in the competitor section)

  // Accounts (3)
  const stripe = await prisma.account.create({
    data: {
      organizationId: org.id,
      name: 'Stripe',
      healthStatus: 'HEALTHY',
      csmName: 'Sarah Chen',
      csmEmail: 'sarah@acmecorp.com',
      meetingCadence: 'MONTHLY',
      notesText: 'High-value account. Very technical team. Strong AI interest.',
      openAsksText: '- API for custom CSAT weights\n- Dedicated success manager\n- Early access to voice features',
    },
  })

  const shopify = await prisma.account.create({
    data: {
      organizationId: org.id,
      name: 'Shopify',
      healthStatus: 'AT_RISK',
      csmName: 'Mike Johnson',
      csmEmail: 'mike@acmecorp.com',
      meetingCadence: 'WEEKLY',
      notesText: 'Recent escalation around ticket SLA accuracy. Renewal in 90 days.',
      risksText: '- Evaluating Zendesk at renewal\n- CFO wants cost reduction\n- SLA prediction accuracy complaints',
      openAsksText: '- SLA prediction accuracy improvements\n- Custom reporting dashboard\n- Price lock for 2-year renewal',
    },
  })

  const airbnb = await prisma.account.create({
    data: {
      organizationId: org.id,
      name: 'Airbnb',
      healthStatus: 'HEALTHY',
      csmName: 'Sarah Chen',
      csmEmail: 'sarah@acmecorp.com',
      meetingCadence: 'QUARTERLY',
      notesText: 'Stable account. Primary use case: host support automation.',
    },
  })

  // Account Updates
  await Promise.all([
    prisma.accountUpdate.create({
      data: {
        accountId: stripe.id,
        summaryText: 'Monthly check-in — positive feedback on AI routing performance',
        feedbackText: 'Team loves the AI routing accuracy improvements. 78% automation rate this month. Asking for custom model training for their payments domain.',
        sentiment: 'POSITIVE',
        urgencyLevel: 'LOW',
        sourceType: 'CSM_INPUT',
        featureRequestsJson: JSON.stringify(['Custom AI model training', 'Payments-specific KB articles', 'API webhook for CSAT scores']),
        issuesJson: JSON.stringify([]),
        recurringConcernsJson: JSON.stringify(['Enterprise SLA', 'Data residency']),
      },
    }),
    prisma.accountUpdate.create({
      data: {
        accountId: shopify.id,
        summaryText: 'At-risk escalation — SLA prediction accuracy and competitive threat',
        feedbackText: 'Shopify CTO flagged SLA prediction is 65% accurate vs promised 80%. Evaluating Zendesk suite. Need to demonstrate improvement by end of quarter.',
        sentiment: 'NEGATIVE',
        urgencyLevel: 'CRITICAL',
        sourceType: 'CSM_INPUT',
        featureRequestsJson: JSON.stringify(['Improved SLA prediction', 'Custom dashboard', 'Bulk ticket operations']),
        issuesJson: JSON.stringify(['SLA prediction accuracy at 65% vs 80% target', 'API rate limiting affecting their integrations']),
        recurringConcernsJson: JSON.stringify(['SLA accuracy', 'API limits', 'Reporting depth']),
      },
    }),
    prisma.accountUpdate.create({
      data: {
        accountId: airbnb.id,
        summaryText: 'Q3 business review — expansion opportunity identified',
        feedbackText: 'Great QBR. Host support team hit 85% AI automation. Interested in expanding to guest support use case. Potential 2x seat expansion.',
        sentiment: 'POSITIVE',
        urgencyLevel: 'MEDIUM',
        sourceType: 'CSM_INPUT',
        featureRequestsJson: JSON.stringify(['Guest-specific AI models', 'Multi-brand support', 'Real-time translation improvements']),
        issuesJson: JSON.stringify([]),
        recurringConcernsJson: JSON.stringify(['Multilingual accuracy']),
      },
    }),
  ])

  // Default Prompt Templates
  const promptTemplates = [
    {
      category: 'spec-generation',
      name: 'Full PRD',
      description: 'Comprehensive product requirements document with all major sections.',
      templateText: `You are a senior product manager writing a production-ready PRD. Use the context below to write a detailed, specific product requirements document.

Feature: {{title}}

{{context}}

Write a full PRD with the following sections:

# {{title}}

## Summary
Brief overview of the feature, its business value, and the expected impact on users and the product.

## Problem Statement
Describe the problem this feature solves. Who is affected, how often, and what is the current workaround or pain point?

## Goals
List 3–5 specific, measurable goals. What does success look like 30/60/90 days after launch?

## Business Requirements
Key business constraints, compliance needs, SLAs, commercial requirements, or stakeholder mandates.

## Functional Requirements
Numbered list of specific, testable requirements. Each should start with "The system shall…"

## Acceptance Criteria
Cover the happy path, edge cases, and error states. Use numbered or Gherkin-style criteria (Given / When / Then).

## Edge Cases & Error States
List potential edge cases, what triggers them, and how the system should respond to each.

## Dependencies
Technical, team, or external dependencies. Flag any blockers or delivery risks.

## Assumptions
State all assumptions made. Each assumption should be validated before build begins.

## Success Metrics
Specific KPIs and how they will be measured post-launch. Include baseline values where known.

Be specific and practical. No filler text.`,
      variablesJson: ['title', 'context'],
    },
    {
      category: 'spec-generation',
      name: 'Half Baked PRD',
      description: 'Lightweight PRD for quick planning and early-stage feature definition.',
      templateText: `You are a product manager writing a concise, actionable PRD for an early-stage feature. Keep each section tight and focused. No filler.

Feature: {{title}}

{{context}}

Write a lightweight PRD:

# {{title}}

## Summary
1–2 sentences: what is this feature and why does it matter?

## Problem Statement
2–3 sentences: what problem does this solve, who is affected, and how often?

## Proposed Solution
Brief description of the intended approach. What are we building?

## Key Requirements
Numbered list of the core requirements only. Stick to must-haves — skip nice-to-haves.

## Basic Acceptance Criteria
The minimum criteria that must be met for this feature to be considered done and shippable.

## Open Questions
Any unresolved questions that could block or change the design before work begins.

Keep the entire document concise and direct. This is a working doc, not a final spec.`,
      variablesJson: ['title', 'context'],
    },
    {
      category: 'spec-generation',
      name: 'Technical Document',
      description: 'Technical implementation-oriented document for engineering and architecture planning.',
      templateText: `You are a senior engineer writing a technical specification. Focus on system behavior, architecture, data design, and implementation details — not user stories.

Feature: {{title}}

{{context}}

Write a technical document:

# {{title}} — Technical Document

## Technical Summary
What is being built at a technical level? Summarize the system changes in 2–3 sentences.

## Architecture & System Behavior
- Components involved and how they interact
- Data flow (describe end-to-end in plain text or pseudo-diagram)
- Key architectural decisions and trade-offs

## API & Integration Considerations
For each new or modified endpoint or integration:
- Method + path (or integration point)
- Request/response schema (TypeScript types preferred)
- Auth requirements and error codes

## Data Considerations
- New or modified database tables, fields, indexes, constraints
- Data types, nullability, defaults, and cardinality
- Migration or backfill requirements

## Dependencies & Constraints
External services, internal services, libraries, or infrastructure this relies on. Note any hard constraints.

## Implementation Notes
Suggested implementation order, rollout strategy, feature flag plan, and backward-compatibility considerations.

## Risks
Technical risks, unknowns, or areas of high complexity that need early investigation.

Be precise. Use concrete types and values wherever possible.`,
      variablesJson: ['title', 'context'],
    },
    {
      category: 'spec-generation',
      name: 'Discovery Brief',
      description: 'Early discovery template for problem framing, research inputs, and next steps.',
      templateText: `You are a product manager writing a discovery brief for early-stage research. Focus entirely on problem framing — do not propose solutions yet.

Feature: {{title}}

{{context}}

Write a discovery brief:

# {{title}} — Discovery Brief

## Opportunity / Problem
In one paragraph: what opportunity or problem have we identified and why does it matter now?

## Background & Context
What do we already know? Include any relevant data, prior research, customer signals, or competitive context.

## Hypotheses
List 3–5 hypotheses to validate. Format each as:
"We believe [assumption]. We'll know we're right when [observable evidence]."

## User & Business Pain Points
- Who experiences this problem? (personas, segments, company sizes)
- In what context does the problem occur? (workflow, trigger, frequency)
- What is the cost of the problem? (lost revenue, churn, support load, inefficiency)

## Research Questions
What must we learn before we can confidently define a solution? List 5–10 specific, open-ended questions.

## Assumptions
What are we assuming to be true that, if wrong, would change the direction? Rank by risk level.

## Next Steps
- Recommended research methods (user interviews, survey, data analysis, prototype test, etc.)
- Suggested participant profile or data sources
- Proposed owner and rough timeline

Do not propose specific solutions or implementation approaches. This is a problem-framing document only.`,
      variablesJson: ['title', 'context'],
    },
    {
      category: 'gap-analysis',
      name: 'Competitor Gap Analysis',
      templateText: `Analyze the competitive gap for our feature vs the competitor.

Our Feature: {{ourFeatureName}}
Our Description: {{ourFeatureDescription}}

Competitor: {{competitorName}}
Competitor Feature: {{competitorFeatureName}}
Competitor Description: {{competitorFeatureDescription}}

Provide:
1. Status (ahead/behind/partial/no-match) with rationale
2. Key similarities
3. Key gaps (what they have that we don't)
4. Opportunities for differentiation
5. Recommended actions for roadmap

Format as JSON: {status, similarities, gaps, opportunities, recommendations}`,
      variablesJson: ['ourFeatureName', 'ourFeatureDescription', 'competitorName', 'competitorFeatureName', 'competitorFeatureDescription'],
    },
    {
      category: 'battle-card',
      name: 'Generate Battle Card',
      templateText: `Generate a sales battle card for our feature against this competitor.

Our Feature: {{featureName}}
Competitor: {{competitorName}}

Create a battle card with:
1. Our strengths (3-5 bullet points)
2. Competitor weaknesses (3-5 points)
3. Key differentiators (3 statements)
4. Handling objections (top 2-3 objections with responses)

Be specific, quantified where possible, and sales-ready.`,
      variablesJson: ['featureName', 'competitorName'],
    },
    {
      category: 'competitor-enrichment',
      name: 'Competitor Feature Extraction',
      templateText: `You are a competitive intelligence agent. Extract product features from the following website content for {{competitorName}}.

Content: {{websiteContent}}

Extract up to 10 distinct product features. For each:
- Name (concise)
- Description (1-2 sentences)
- Category (e.g., AI, Analytics, Automation, Channels)

Return as JSON array: [{name, description, category}]`,
      variablesJson: ['competitorName', 'websiteContent'],
    },
    {
      category: 'roadmap-suggestion',
      name: 'AI Roadmap Suggestions',
      templateText: `Based on the following context, suggest 5 high-priority roadmap items.

Our Features: {{ourFeatures}}
Competitor Gaps: {{competitorGaps}}
Account Feedback: {{accountFeedback}}
Existing Roadmap: {{existingRoadmap}}

For each suggestion:
- Title
- Description
- Source type (COMPETITOR_GAP, ACCOUNT_FEEDBACK, STRATEGIC)
- Priority (HIGH/MEDIUM/LOW)
- RICE scores (Reach 1-100, Impact 1-10, Confidence %, Effort 1-20)
- Rationale

Return as JSON array.`,
      variablesJson: ['ourFeatures', 'competitorGaps', 'accountFeedback', 'existingRoadmap'],
    },
    {
      category: 'account-analysis',
      name: 'Extract Feature Requests from Meeting Notes',
      templateText: `Extract actionable feature requests from the following customer meeting notes.

Account: {{accountName}}
Notes: {{meetingNotes}}

Extract:
1. Feature requests (explicit asks)
2. Pain points (implicit needs)
3. Recurring concerns
4. Sentiment (POSITIVE/NEUTRAL/NEGATIVE/MIXED)
5. Urgency (LOW/MEDIUM/HIGH/CRITICAL)

Return as JSON: {featureRequests: [], painPoints: [], concerns: [], sentiment, urgency}`,
      variablesJson: ['accountName', 'meetingNotes'],
    },
    {
      category: 'comparison',
      name: 'Feature Comparison Summary',
      templateText: `Summarize how we compare to competitors for this feature category.

Feature Category: {{category}}
Our Capabilities: {{ourCapabilities}}
Competitor Landscape: {{competitorData}}

Provide:
1. Executive summary (2-3 sentences)
2. Where we lead
3. Where we lag
4. Strategic recommendation

Target audience: VP Product presenting to board.`,
      variablesJson: ['category', 'ourCapabilities', 'competitorData'],
    },
    {
      category: 'competitor-enrichment',
      name: 'Competitor Diff Analysis',
      templateText: `Compare two snapshots of competitor data and identify what changed.

Competitor: {{competitorName}}
Previous Snapshot: {{previousData}}
Current Snapshot: {{currentData}}

Identify:
1. NEW features (not in previous)
2. ENHANCED features (significantly updated)
3. DEPRECATED features (removed)
4. Unchanged features

For each change, estimate PM action needed.
Return as JSON: {new: [], enhanced: [], deprecated: [], pmActions: []}`,
      variablesJson: ['competitorName', 'previousData', 'currentData'],
    },
    {
      category: 'account-analysis',
      name: 'Account Health Summary',
      templateText: `Generate an account health summary for the customer success team.

Account: {{accountName}}
Recent Updates: {{recentUpdates}}
Health Status: {{healthStatus}}
Open Issues: {{openIssues}}

Generate:
1. 2-sentence executive summary
2. Risk factors (if any)
3. Opportunities for expansion
4. Recommended next actions
5. Renewal probability (High/Medium/Low) with rationale`,
      variablesJson: ['accountName', 'recentUpdates', 'healthStatus', 'openIssues'],
    },
    {
      category: 'roadmap-suggestion',
      name: 'RICE Score Estimator',
      templateText: `Estimate RICE scores for the following roadmap item.

Feature: {{featureTitle}}
Description: {{description}}
Target Customer Segment: {{segment}}
Implementation Complexity: {{complexity}}

Estimate:
- Reach (1-100): What % of MAU will use this?
- Impact (1-10): How much does it move the needle per user?
- Confidence (1-100%): How certain are these estimates?
- Effort (story points, 1-20): Engineering complexity

Provide RICE score = (Reach × Impact × Confidence) / Effort
Include rationale for each estimate.`,
      variablesJson: ['featureTitle', 'description', 'segment', 'complexity'],
    },
    {
      category: 'custom',
      name: 'Custom Analysis',
      templateText: `{{customPrompt}}

Context: {{context}}`,
      variablesJson: ['customPrompt', 'context'],
    },

    // ── Competitor Intelligence Templates ──────────────────────────────────
    {
      category: 'competitor-intelligence',
      name: 'COMPETITOR_REPORT_WRITER',
      description: 'Full 13-section competitor intelligence report',
      templateText: `You are a senior competitive intelligence analyst. Write a comprehensive 13-section competitor analysis report for {{competitorName}}.

Company context: {{companyContext}}
Features: {{featuresContext}}
Recent updates: {{updatesContext}}
Sources: {{sourcesContext}}

Generate the full report with sections: Executive Summary, Company & Product Positioning, Product Capabilities, Pricing & Packaging, Security & Compliance, Ecosystem & Developer Readiness, Community & Market Sentiment, Historical Changes, Competitive Comparison, Risks & Unknowns, PM Takeaways, Sales/GTM Takeaways, Evidence Appendix.`,
      variablesJson: ['competitorName', 'companyContext', 'featuresContext', 'updatesContext', 'sourcesContext'],
    },
    {
      category: 'competitor-intelligence',
      name: 'SOURCE_DISCOVERY',
      description: 'Suggest source URLs to monitor for a competitor domain',
      templateText: `You are a competitive intelligence analyst. Given the company "{{companyName}}" with domain "{{domain}}", suggest 8-10 specific source URLs to monitor for competitive intelligence.

For each source provide: url, sourceType (WEBSITE|DOCS|PRICING|RELEASE_NOTES|BLOG|TRUST|INTEGRATIONS|GITHUB|REDDIT|YOUTUBE|NEWS), label, priority (HIGH|NORMAL|LOW), rationale.

Return as JSON array only.`,
      variablesJson: ['companyName', 'domain'],
    },
    {
      category: 'competitor-intelligence',
      name: 'SOURCE_CLASSIFIER',
      description: 'Classify a URL into a CompetitorSource type',
      templateText: `Classify the following URL into one of these source types: WEBSITE | DOCS | PRICING | RELEASE_NOTES | BLOG | TRUST | INTEGRATIONS | GITHUB | REDDIT | YOUTUBE | PRODUCT_HUNT | NEWS | CUSTOM

URL: {{url}}

Return JSON: {"sourceType": "...", "label": "...", "priority": "HIGH|NORMAL|LOW", "rationale": "..."}`,
      variablesJson: ['url'],
    },
    {
      category: 'competitor-intelligence',
      name: 'EVIDENCE_EXTRACTOR',
      description: 'Extract feature claims from page text',
      templateText: `You are a competitive intelligence extraction agent. Extract product feature claims from the following page content for {{competitorName}}.

Page content:
{{pageContent}}

For each feature or capability found, return JSON array: [{"featureName": "...", "description": "...", "category": "...", "confidence": 0.0-1.0, "evidenceSnippet": "..."}]

Return only valid JSON array.`,
      variablesJson: ['competitorName', 'pageContent'],
    },
    {
      category: 'competitor-intelligence',
      name: 'COMMUNITY_SUMMARIZER',
      description: 'Summarize Reddit/HN thread for competitive signals',
      templateText: `Summarize the following community discussion thread for competitive intelligence signals about {{competitorName}}.

Thread content:
{{threadContent}}

Extract: sentiment (POSITIVE|NEGATIVE|NEUTRAL|MIXED), key concerns, feature requests mentioned, competitor comparisons, notable quotes.

Return JSON: {"sentiment": "...", "keyConcerns": [], "featureRequests": [], "comparisons": [], "notableQuotes": []}`,
      variablesJson: ['competitorName', 'threadContent'],
    },
    {
      category: 'competitor-intelligence',
      name: 'CHANGE_DETECTOR',
      description: 'Compare old vs new content for competitive changes',
      templateText: `Compare these two versions of content from {{competitorName}} and identify meaningful changes.

Previous version:
{{previousContent}}

Current version:
{{currentContent}}

Identify changes relevant to: features, pricing, messaging, integrations, compliance, or strategy.

Return JSON: {"hasSignificantChanges": true/false, "changes": [{"type": "FEATURE_LAUNCHED|PRICING_CHANGED|...", "description": "...", "significance": "HIGH|MEDIUM|LOW"}]}`,
      variablesJson: ['competitorName', 'previousContent', 'currentContent'],
    },
    {
      category: 'competitor-intelligence',
      name: 'BATTLECARD_SYNTHESIZER',
      description: 'Generate battlecard content from competitor report',
      templateText: `You are a competitive intelligence analyst. Extract battle card content from the following intelligence report about {{competitorName}}.

Report:
{{reportContent}}

Generate concise, sales-ready content for each section. Return JSON:
{
  "strengthsText": "bullet list of their strengths (one per line, prefixed with •)",
  "weaknessesText": "bullet list of their weaknesses (one per line, prefixed with •)",
  "differentiatorsText": "bullet list of how we win against them (one per line, prefixed with •)",
  "salesMessagingText": "2-3 sentences of objection handling"
}`,
      variablesJson: ['competitorName', 'reportContent'],
    },
    {
      category: 'competitor-intelligence',
      name: 'EXEC_SUMMARY_WRITER',
      description: '3-sentence executive summary from a competitor report',
      templateText: `Write a 3-sentence executive summary of the competitive threat from {{competitorName}} based on this report.

Report excerpt:
{{reportExcerpt}}

Focus on: threat level, key differentiators, and top action item. Be direct and PM-ready.`,
      variablesJson: ['competitorName', 'reportExcerpt'],
    },
    {
      category: 'competitor-intelligence',
      name: 'CRITIQUE_REVIEWER',
      description: 'Review a competitor report for overclaims and intelligence gaps',
      templateText: `Review the following competitor intelligence report for {{competitorName}} and identify:
1. Overclaims or statements not supported by evidence
2. Significant intelligence gaps (what we don't know)
3. Sections that need more supporting evidence
4. Confidence scores that seem too high or low

Report:
{{reportContent}}

Return JSON: {"overclaims": [], "gaps": [], "weakSections": [], "recommendations": []}`,
      variablesJson: ['competitorName', 'reportContent'],
    },
    {
      category: 'competitor-intelligence',
      name: 'FEATURE_DETAIL_COMPOSER',
      description: 'Write feature detail explanation from evidence snippets',
      templateText: `Write a detailed, accurate explanation of the {{featureName}} feature from {{competitorName}} based on the following evidence.

Evidence snippets:
{{evidenceSnippets}}

Write 2-3 paragraphs covering: what it does, how it's positioned, who it targets, and any limitations observed. Be factual — only include what's supported by evidence.`,
      variablesJson: ['featureName', 'competitorName', 'evidenceSnippets'],
    },
  ]

  await Promise.all(
    promptTemplates.map(p =>
      prisma.prompt.create({
        data: {
          organizationId: org.id,
          category: p.category,
          name: p.name,
          description: (p as any).description ?? '',
          templateText: p.templateText,
          variablesJson: JSON.stringify(p.variablesJson),
          isActive: true,
          version: 1,
        },
      })
    )
  )

  // LLM Config stub (no real key)
  await prisma.lLMConfig.create({
    data: {
      organizationId: org.id,
      provider: 'ANTHROPIC',
      label: 'Anthropic Claude (demo — add your key)',
      apiKeyEncrypted: '',
      iv: '',
      defaultModel: 'claude-sonnet-4-6',
      isActive: true,
    },
  })

  // Workflow Run (history)
  const wfRun = await prisma.workflowRun.create({
    data: {
      organizationId: org.id,
      workflowType: 'COMPETITOR_REFRESH',
      status: 'COMPLETED',
    },
  })
  // AUDIT P0-3: typed Prisma update (was SQLite-only `?` raw SQL).
  await prisma.workflowRun.update({
    where: { id: wfRun.id },
    data: { totalTokens: 45230, estimatedCost: 0.0678 },
  })

  await (prisma as any).workflowStepRun.createMany({
    data: [
      { workflowRunId: wfRun.id, stepName: 'CRAWL_COMPETITORS', status: 'COMPLETED' },
      { workflowRunId: wfRun.id, stepName: 'DETECT_CHANGES', status: 'COMPLETED' },
      { workflowRunId: wfRun.id, stepName: 'ANALYZE_GAPS', status: 'COMPLETED' },
    ],
  })

  // Notifications (10)
  await prisma.notification.createMany({
    data: [
      { organizationId: org.id, type: 'COMPETITOR_UPDATE', title: 'Fin AI upgraded to GPT-4o', message: 'Intercom upgraded Fin AI to GPT-4o — review recommended', read: false, entityType: 'CompetitorKeyUpdate' },
      { organizationId: org.id, type: 'COMPETITOR_UPDATE', title: 'Zendesk new feature detected', message: 'Zendesk launched AI-generated CSAT summaries feature', read: false, entityType: 'CompetitorKeyUpdate' },
      { organizationId: org.id, type: 'WORKFLOW_COMPLETE', title: 'Competitor refresh complete', message: 'Competitor refresh workflow completed — 3 updates detected', read: false, entityType: 'WorkflowRun', entityId: wfRun.id },
      { organizationId: org.id, type: 'GENERAL', title: 'Account at risk', message: 'Shopify account flagged as AT_RISK — review account health', read: false, entityType: 'Account', entityId: shopify.id },
      { organizationId: org.id, type: 'SPEC_GENERATED', title: 'New spec generated', message: 'Spec generated for: Predictive CSAT Scoring', read: true, entityType: 'Spec', entityId: spec1.id },
      { organizationId: org.id, type: 'SPEC_GENERATED', title: 'New spec generated', message: 'Spec generated for: Voice Channel Integration', read: true, entityType: 'Spec', entityId: spec2.id },
      { organizationId: org.id, type: 'GENERAL', title: 'Expansion opportunity', message: 'Stripe account shared expansion interest — 2x seat opportunity', read: true, entityType: 'Account', entityId: stripe.id },
      { organizationId: org.id, type: 'COMPETITOR_UPDATE', title: 'Freshdesk update', message: 'Freshdesk added social media channel support', read: true, entityType: 'CompetitorKeyUpdate' },
      { organizationId: org.id, type: 'GENERAL', title: 'AI suggestions added', message: 'AI roadmap suggestions generated — 2 new items added', read: true, entityType: 'RoadmapItem' },
      { organizationId: org.id, type: 'GENERAL', title: 'Welcome to ProductOS', message: 'Welcome to ProductOS! Your demo environment is ready.', read: true, entityType: null },
    ],
  })

  console.log('✅ Seed complete!')
  console.log('   Login: admin@acmecorp.com / demo1234')
  console.log('   Login: pm@acmecorp.com / demo1234')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
