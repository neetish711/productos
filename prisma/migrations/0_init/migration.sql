-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "scoringConfigJson" TEXT NOT NULL DEFAULT '{}',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "apiKeyEncrypted" TEXT,
    "iv" TEXT,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "connectedAt" TIMESTAMP(3),
    "connectedBy" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PM',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "avatarUrl" TEXT,
    "permissionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OurFeature" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "sourceFileId" TEXT,
    "build" TEXT,
    "owner" TEXT,
    "coverImageUrl" TEXT,
    "targetUsers" TEXT NOT NULL DEFAULT '',
    "valueProposition" TEXT NOT NULL DEFAULT '',
    "platform" TEXT,
    "maturityLevel" TEXT NOT NULL DEFAULT 'GA',
    "isCustomerFacing" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "docsLinks" TEXT NOT NULL DEFAULT '[]',
    "setupLinks" TEXT NOT NULL DEFAULT '[]',
    "designFiles" TEXT NOT NULL DEFAULT '[]',
    "releaseNotes" TEXT NOT NULL DEFAULT '',
    "competitorMappings" TEXT NOT NULL DEFAULT '[]',
    "configDetails" TEXT NOT NULL DEFAULT '',
    "useCases" TEXT NOT NULL DEFAULT '',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "introducedInBuild" TEXT,
    "updatedInBuild" TEXT,
    "changelogJson" TEXT NOT NULL DEFAULT '[]',
    "contentBlocksJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OurFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureQuestion" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askedBy" TEXT NOT NULL DEFAULT 'Anonymous',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "answersJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureSolution" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FAQ',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFeedback" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'IMPROVEMENT',
    "submittedBy" TEXT NOT NULL DEFAULT 'Anonymous',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "refreshFrequencyDays" INTEGER NOT NULL DEFAULT 15,
    "lastRefreshAt" TIMESTAMP(3),
    "setupStatus" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "reportStatus" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "lastReportAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorFeature" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'General',
    "sourcesJson" TEXT NOT NULL DEFAULT '[]',
    "prosText" TEXT NOT NULL DEFAULT '',
    "consText" TEXT NOT NULL DEFAULT '',
    "marketSentimentText" TEXT NOT NULL DEFAULT '',
    "enrichmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "matchedOurFeatureId" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'NO_MATCH',
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roadmapImplicationText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
    "officialSourceCount" INTEGER NOT NULL DEFAULT 0,
    "thirdPartySourceCount" INTEGER NOT NULL DEFAULT 0,
    "communitySourceCount" INTEGER NOT NULL DEFAULT 0,
    "lastExtractedAt" TIMESTAMP(3),
    "changeHistory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEvidence" (
    "id" TEXT NOT NULL,
    "competitorFeatureId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL DEFAULT 'webpage',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "dateAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screenshotPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "ourFeatureId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "similaritiesText" TEXT NOT NULL DEFAULT '',
    "differencesText" TEXT NOT NULL DEFAULT '',
    "enhancementOpportunitiesText" TEXT NOT NULL DEFAULT '',
    "keyTakeawaysText" TEXT NOT NULL DEFAULT '',
    "positioning" TEXT NOT NULL DEFAULT 'NO_MATCH',
    "citationsJson" TEXT NOT NULL DEFAULT '[]',
    "deepReportMd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'General',
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceReferenceId" TEXT,
    "sourceReferenceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riceReach" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riceImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riceEffort" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scoringInputsJson" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "specId" TEXT,
    "voiceTranscriptText" TEXT,
    "referenceDocsJson" TEXT NOT NULL DEFAULT '[]',
    "targetQuarter" TEXT,
    "isAiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "aiRationale" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "dismissedAt" TIMESTAMP(3),
    "jiraKey" TEXT,
    "jiraStatus" TEXT,
    "jiraLastSyncAt" TIMESTAMP(3),
    "duplicatedFromId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "specStatus" TEXT NOT NULL DEFAULT 'NO_SPEC',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "prototypeStatus" TEXT NOT NULL DEFAULT 'NONE',
    "lovableProjectUrl" TEXT,
    "lovableProjectId" TEXT,
    "githubRepoUrl" TEXT,
    "githubBranch" TEXT,
    "githubCommitRef" TEXT,
    "engineeringHandoffStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "prototypeIterationCount" INTEGER NOT NULL DEFAULT 0,
    "lastPublishedAt" TIMESTAMP(3),
    "lastPublishedBy" TEXT,
    "sourcePrdVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "mappingJson" TEXT NOT NULL DEFAULT '{}',
    "parsedDataJson" TEXT NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapActivity" (
    "id" TEXT NOT NULL,
    "roadmapItemId" TEXT NOT NULL,
    "specId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL DEFAULT 'System',
    "actorType" TEXT NOT NULL DEFAULT 'USER',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapDependency" (
    "id" TEXT NOT NULL,
    "fromItemId" TEXT NOT NULL,
    "toItemId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'RELATED_TO',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrototypePublish" (
    "id" TEXT NOT NULL,
    "roadmapItemId" TEXT NOT NULL,
    "publishVersion" INTEGER NOT NULL,
    "sourcePrdVersionId" TEXT,
    "sourcePrdVersionNum" INTEGER NOT NULL DEFAULT 0,
    "lovablePromptSnapshot" TEXT NOT NULL DEFAULT '',
    "lovablePromptVersion" INTEGER NOT NULL DEFAULT 1,
    "extractionModel" TEXT,
    "extractionProvider" TEXT,
    "lovableProjectUrl" TEXT,
    "lovableProjectId" TEXT,
    "githubRepoUrl" TEXT,
    "githubBranch" TEXT,
    "githubCommitRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROMPT_GENERATED',
    "prototypeOutdated" BOOLEAN NOT NULL DEFAULT false,
    "publishedByUserId" TEXT,
    "publishedByName" TEXT NOT NULL DEFAULT '',
    "linkedAt" TIMESTAMP(3),
    "handedOffAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrototypePublish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spec" (
    "id" TEXT NOT NULL,
    "roadmapItemId" TEXT,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "generationMethod" TEXT NOT NULL DEFAULT 'AI_GENERATED',
    "sourcePromptId" TEXT,
    "referenceDocIds" TEXT NOT NULL DEFAULT '[]',
    "lifecycleState" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedVersionId" TEXT,
    "reviewDueDate" TIMESTAMP(3),
    "reviewFeedback" TEXT,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "handoffStatus" TEXT NOT NULL DEFAULT 'NOT_READY',
    "templateType" TEXT NOT NULL DEFAULT 'FULL_PRD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecVersion" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "versionName" TEXT,
    "contentMd" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "changeSummary" TEXT,
    "provider" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "promptTemplateVersion" TEXT,
    "promptTemplateId" TEXT,
    "parentVersionId" TEXT,
    "generationScope" TEXT NOT NULL DEFAULT 'FULL_DOC',
    "generationMode" TEXT NOT NULL DEFAULT 'FRESH_DRAFT',
    "commentsApplied" INTEGER NOT NULL DEFAULT 0,
    "contextSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "additionalInstructions" TEXT,
    "sectionsRegeneratedJson" TEXT NOT NULL DEFAULT '[]',
    "sectionOriginsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRDComment" (
    "id" TEXT NOT NULL,
    "specVersionId" TEXT NOT NULL,
    "anchorStart" INTEGER NOT NULL DEFAULT 0,
    "anchorEnd" INTEGER NOT NULL DEFAULT 0,
    "anchorText" TEXT NOT NULL DEFAULT '',
    "sectionName" TEXT NOT NULL DEFAULT '',
    "issueType" TEXT NOT NULL DEFAULT 'unclear',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "body" TEXT NOT NULL,
    "includeInRegeneration" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actionType" TEXT,
    "createdByUserId" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRDComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "ourFeatureId" TEXT,
    "competitorIdsJson" TEXT NOT NULL DEFAULT '[]',
    "competitorNamesJson" TEXT NOT NULL DEFAULT '[]',
    "strengthsText" TEXT NOT NULL DEFAULT '',
    "weaknessesText" TEXT NOT NULL DEFAULT '',
    "differentiatorsText" TEXT NOT NULL DEFAULT '',
    "improvementOpportunitiesText" TEXT NOT NULL DEFAULT '',
    "pmTakeawaysText" TEXT NOT NULL DEFAULT '',
    "salesMessagingText" TEXT NOT NULL DEFAULT '',
    "citationsJson" TEXT NOT NULL DEFAULT '[]',
    "contentMd" TEXT NOT NULL DEFAULT '',
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "healthStatus" TEXT NOT NULL DEFAULT 'NEW',
    "csmName" TEXT NOT NULL DEFAULT '',
    "csmEmail" TEXT,
    "meetingCadence" TEXT NOT NULL DEFAULT 'MONTHLY',
    "notesText" TEXT NOT NULL DEFAULT '',
    "risksText" TEXT NOT NULL DEFAULT '',
    "openAsksText" TEXT NOT NULL DEFAULT '',
    "chatSpaceId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastMeetingAt" TIMESTAMP(3),
    "nextMeetingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountUpdate" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryText" TEXT NOT NULL DEFAULT '',
    "issuesJson" TEXT NOT NULL DEFAULT '[]',
    "featureRequestsJson" TEXT NOT NULL DEFAULT '[]',
    "sentiment" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "feedbackText" TEXT NOT NULL DEFAULT '',
    "urgencyLevel" TEXT NOT NULL DEFAULT 'LOW',
    "recurringConcernsJson" TEXT NOT NULL DEFAULT '[]',
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "roadmapItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorKeyUpdate" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "updateType" TEXT NOT NULL DEFAULT 'NEW_FEATURE',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousSnapshotReference" TEXT,
    "diffSummaryText" TEXT NOT NULL DEFAULT '',
    "pmActionStatus" TEXT NOT NULL DEFAULT 'NONE',
    "significance" TEXT NOT NULL DEFAULT 'MEDIUM',
    "evidenceSnippet" TEXT,
    "changeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorKeyUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "templateText" TEXT NOT NULL,
    "variablesJson" TEXT NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "storagePath" TEXT NOT NULL,
    "parsedText" TEXT,
    "parsedJson" TEXT,
    "uploadPurpose" TEXT NOT NULL DEFAULT 'GENERAL',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "inputParamsJson" TEXT NOT NULL DEFAULT '{}',
    "outputSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "llmProvider" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStepRun" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "inputJson" TEXT NOT NULL DEFAULT '{}',
    "outputJson" TEXT NOT NULL DEFAULT '{}',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStepRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "baseUrl" TEXT,
    "defaultModel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'DEFAULT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledRefreshJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitorId" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'competitor_refresh',
    "cronExpression" TEXT NOT NULL DEFAULT '0 6 */15 * *',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledRefreshJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "entityType" TEXT,
    "entityId" TEXT,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptExecutionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "promptId" TEXT,
    "workflowRunId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSource" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'WEBSITE',
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "crawlFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "includePaths" TEXT,
    "excludePaths" TEXT,
    "crawlDepth" INTEGER NOT NULL DEFAULT 2,
    "contentTypes" TEXT,
    "recrawlStrategy" TEXT NOT NULL DEFAULT 'ALL',
    "changeDetectionTypes" TEXT,
    "lastCrawledAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastChangeAt" TIMESTAMP(3),
    "freshnessScore" DOUBLE PRECISION,
    "evidenceScore" DOUBLE PRECISION,
    "crawlHealthStatus" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAutoDiscovered" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorReport" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "contentMd" TEXT,
    "executiveSummary" TEXT,
    "confidenceOverall" DOUBLE PRECISION,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3),
    "modelUsed" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorReportVersion" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentMd" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorReportVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "requestedRole" TEXT NOT NULL DEFAULT 'VIEWER',
    "requestedProductsJson" TEXT NOT NULL DEFAULT '[]',
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProductAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProductAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BattleCardCompetitor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "IntegrationConfig_organizationId_idx" ON "IntegrationConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_organizationId_integrationType_key" ON "IntegrationConfig"("organizationId", "integrationType");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Product_organizationId_idx" ON "Product"("organizationId");

-- CreateIndex
CREATE INDEX "OurFeature_productId_idx" ON "OurFeature"("productId");

-- CreateIndex
CREATE INDEX "OurFeature_category_idx" ON "OurFeature"("category");

-- CreateIndex
CREATE INDEX "OurFeature_status_idx" ON "OurFeature"("status");

-- CreateIndex
CREATE INDEX "FeatureQuestion_featureId_idx" ON "FeatureQuestion"("featureId");

-- CreateIndex
CREATE INDEX "FeatureQuestion_status_idx" ON "FeatureQuestion"("status");

-- CreateIndex
CREATE INDEX "FeatureSolution_featureId_idx" ON "FeatureSolution"("featureId");

-- CreateIndex
CREATE INDEX "FeatureSolution_type_idx" ON "FeatureSolution"("type");

-- CreateIndex
CREATE INDEX "FeatureFeedback_featureId_idx" ON "FeatureFeedback"("featureId");

-- CreateIndex
CREATE INDEX "FeatureFeedback_status_idx" ON "FeatureFeedback"("status");

-- CreateIndex
CREATE INDEX "FeatureFeedback_type_idx" ON "FeatureFeedback"("type");

-- CreateIndex
CREATE INDEX "Competitor_organizationId_idx" ON "Competitor"("organizationId");

-- CreateIndex
CREATE INDEX "CompetitorFeature_competitorId_idx" ON "CompetitorFeature"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorFeature_matchStatus_idx" ON "CompetitorFeature"("matchStatus");

-- CreateIndex
CREATE INDEX "SourceEvidence_competitorFeatureId_idx" ON "SourceEvidence"("competitorFeatureId");

-- CreateIndex
CREATE INDEX "Comparison_ourFeatureId_idx" ON "Comparison"("ourFeatureId");

-- CreateIndex
CREATE INDEX "Comparison_competitorId_idx" ON "Comparison"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "Comparison_ourFeatureId_competitorId_key" ON "Comparison"("ourFeatureId", "competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapItem_specId_key" ON "RoadmapItem"("specId");

-- CreateIndex
CREATE INDEX "RoadmapItem_productId_idx" ON "RoadmapItem"("productId");

-- CreateIndex
CREATE INDEX "RoadmapItem_status_idx" ON "RoadmapItem"("status");

-- CreateIndex
CREATE INDEX "RoadmapItem_sortOrder_idx" ON "RoadmapItem"("sortOrder");

-- CreateIndex
CREATE INDEX "RoadmapItem_specStatus_idx" ON "RoadmapItem"("specStatus");

-- CreateIndex
CREATE INDEX "RoadmapItem_prototypeStatus_idx" ON "RoadmapItem"("prototypeStatus");

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_idx" ON "ImportJob"("organizationId");

-- CreateIndex
CREATE INDEX "ImportJob_productId_idx" ON "ImportJob"("productId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "RoadmapActivity_roadmapItemId_idx" ON "RoadmapActivity"("roadmapItemId");

-- CreateIndex
CREATE INDEX "RoadmapActivity_specId_idx" ON "RoadmapActivity"("specId");

-- CreateIndex
CREATE INDEX "RoadmapActivity_createdAt_idx" ON "RoadmapActivity"("createdAt");

-- CreateIndex
CREATE INDEX "RoadmapDependency_fromItemId_idx" ON "RoadmapDependency"("fromItemId");

-- CreateIndex
CREATE INDEX "RoadmapDependency_toItemId_idx" ON "RoadmapDependency"("toItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapDependency_fromItemId_toItemId_relationshipType_key" ON "RoadmapDependency"("fromItemId", "toItemId", "relationshipType");

-- CreateIndex
CREATE INDEX "PrototypePublish_roadmapItemId_idx" ON "PrototypePublish"("roadmapItemId");

-- CreateIndex
CREATE INDEX "PrototypePublish_sourcePrdVersionId_idx" ON "PrototypePublish"("sourcePrdVersionId");

-- CreateIndex
CREATE INDEX "PrototypePublish_status_idx" ON "PrototypePublish"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Spec_roadmapItemId_key" ON "Spec"("roadmapItemId");

-- CreateIndex
CREATE INDEX "Spec_roadmapItemId_idx" ON "Spec"("roadmapItemId");

-- CreateIndex
CREATE INDEX "Spec_lifecycleState_idx" ON "Spec"("lifecycleState");

-- CreateIndex
CREATE INDEX "SpecVersion_specId_idx" ON "SpecVersion"("specId");

-- CreateIndex
CREATE INDEX "SpecVersion_version_idx" ON "SpecVersion"("version");

-- CreateIndex
CREATE INDEX "PRDComment_specVersionId_idx" ON "PRDComment"("specVersionId");

-- CreateIndex
CREATE INDEX "PRDComment_status_idx" ON "PRDComment"("status");

-- CreateIndex
CREATE INDEX "BattleCard_organizationId_idx" ON "BattleCard"("organizationId");

-- CreateIndex
CREATE INDEX "Account_organizationId_idx" ON "Account"("organizationId");

-- CreateIndex
CREATE INDEX "Account_healthStatus_idx" ON "Account"("healthStatus");

-- CreateIndex
CREATE INDEX "AccountUpdate_accountId_idx" ON "AccountUpdate"("accountId");

-- CreateIndex
CREATE INDEX "CompetitorKeyUpdate_competitorId_idx" ON "CompetitorKeyUpdate"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorKeyUpdate_detectedAt_idx" ON "CompetitorKeyUpdate"("detectedAt");

-- CreateIndex
CREATE INDEX "Prompt_organizationId_idx" ON "Prompt"("organizationId");

-- CreateIndex
CREATE INDEX "Prompt_category_idx" ON "Prompt"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_organizationId_category_name_key" ON "Prompt"("organizationId", "category", "name");

-- CreateIndex
CREATE INDEX "UploadedFile_organizationId_idx" ON "UploadedFile"("organizationId");

-- CreateIndex
CREATE INDEX "UploadedFile_uploadPurpose_idx" ON "UploadedFile"("uploadPurpose");

-- CreateIndex
CREATE INDEX "WorkflowRun_organizationId_idx" ON "WorkflowRun"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowType_idx" ON "WorkflowRun"("workflowType");

-- CreateIndex
CREATE INDEX "WorkflowStepRun_workflowRunId_idx" ON "WorkflowStepRun"("workflowRunId");

-- CreateIndex
CREATE INDEX "LLMConfig_organizationId_idx" ON "LLMConfig"("organizationId");

-- CreateIndex
CREATE INDEX "ScheduledRefreshJob_organizationId_idx" ON "ScheduledRefreshJob"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "PromptExecutionLog_organizationId_idx" ON "PromptExecutionLog"("organizationId");

-- CreateIndex
CREATE INDEX "PromptExecutionLog_createdAt_idx" ON "PromptExecutionLog"("createdAt");

-- CreateIndex
CREATE INDEX "CompetitorSource_competitorId_idx" ON "CompetitorSource"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorSource_status_idx" ON "CompetitorSource"("status");

-- CreateIndex
CREATE INDEX "CompetitorReport_competitorId_idx" ON "CompetitorReport"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorReport_organizationId_idx" ON "CompetitorReport"("organizationId");

-- CreateIndex
CREATE INDEX "CompetitorReport_status_idx" ON "CompetitorReport"("status");

-- CreateIndex
CREATE INDEX "CompetitorReportVersion_reportId_idx" ON "CompetitorReportVersion"("reportId");

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");

-- CreateIndex
CREATE INDEX "AccessRequest_organizationId_idx" ON "AccessRequest"("organizationId");

-- CreateIndex
CREATE INDEX "UserProductAccess_userId_idx" ON "UserProductAccess"("userId");

-- CreateIndex
CREATE INDEX "UserProductAccess_productId_idx" ON "UserProductAccess"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProductAccess_userId_productId_key" ON "UserProductAccess"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "_BattleCardCompetitor_AB_unique" ON "_BattleCardCompetitor"("A", "B");

-- CreateIndex
CREATE INDEX "_BattleCardCompetitor_B_index" ON "_BattleCardCompetitor"("B");

-- AddForeignKey
ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OurFeature" ADD CONSTRAINT "OurFeature_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureQuestion" ADD CONSTRAINT "FeatureQuestion_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "OurFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureSolution" ADD CONSTRAINT "FeatureSolution_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "OurFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFeedback" ADD CONSTRAINT "FeatureFeedback_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "OurFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorFeature" ADD CONSTRAINT "CompetitorFeature_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidence" ADD CONSTRAINT "SourceEvidence_competitorFeatureId_fkey" FOREIGN KEY ("competitorFeatureId") REFERENCES "CompetitorFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_ourFeatureId_fkey" FOREIGN KEY ("ourFeatureId") REFERENCES "OurFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapActivity" ADD CONSTRAINT "RoadmapActivity_roadmapItemId_fkey" FOREIGN KEY ("roadmapItemId") REFERENCES "RoadmapItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapDependency" ADD CONSTRAINT "RoadmapDependency_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "RoadmapItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapDependency" ADD CONSTRAINT "RoadmapDependency_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "RoadmapItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrototypePublish" ADD CONSTRAINT "PrototypePublish_roadmapItemId_fkey" FOREIGN KEY ("roadmapItemId") REFERENCES "RoadmapItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spec" ADD CONSTRAINT "Spec_roadmapItemId_fkey" FOREIGN KEY ("roadmapItemId") REFERENCES "RoadmapItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecVersion" ADD CONSTRAINT "SpecVersion_specId_fkey" FOREIGN KEY ("specId") REFERENCES "Spec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecVersion" ADD CONSTRAINT "SpecVersion_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRDComment" ADD CONSTRAINT "PRDComment_specVersionId_fkey" FOREIGN KEY ("specVersionId") REFERENCES "SpecVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRDComment" ADD CONSTRAINT "PRDComment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleCard" ADD CONSTRAINT "BattleCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleCard" ADD CONSTRAINT "BattleCard_ourFeatureId_fkey" FOREIGN KEY ("ourFeatureId") REFERENCES "OurFeature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountUpdate" ADD CONSTRAINT "AccountUpdate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorKeyUpdate" ADD CONSTRAINT "CompetitorKeyUpdate_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMConfig" ADD CONSTRAINT "LLMConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledRefreshJob" ADD CONSTRAINT "ScheduledRefreshJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledRefreshJob" ADD CONSTRAINT "ScheduledRefreshJob_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExecutionLog" ADD CONSTRAINT "PromptExecutionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExecutionLog" ADD CONSTRAINT "PromptExecutionLog_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSource" ADD CONSTRAINT "CompetitorSource_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorReport" ADD CONSTRAINT "CompetitorReport_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorReport" ADD CONSTRAINT "CompetitorReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorReportVersion" ADD CONSTRAINT "CompetitorReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CompetitorReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProductAccess" ADD CONSTRAINT "UserProductAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProductAccess" ADD CONSTRAINT "UserProductAccess_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BattleCardCompetitor" ADD CONSTRAINT "_BattleCardCompetitor_A_fkey" FOREIGN KEY ("A") REFERENCES "BattleCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BattleCardCompetitor" ADD CONSTRAINT "_BattleCardCompetitor_B_fkey" FOREIGN KEY ("B") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

