#!/usr/bin/env node

/**
 * Jira MCP Server for Claude Code
 *
 * Provides tools to interact with Jira Cloud/Server via REST API.
 * Configure via environment variables:
 *   JIRA_HOST     - e.g., https://your-org.atlassian.net
 *   JIRA_EMAIL    - your Jira account email
 *   JIRA_API_TOKEN - API token from https://id.atlassian.com/manage-profile/security/api-tokens
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "@modelcontextprotocol/sdk/deps/zod.js";

const JIRA_HOST = process.env.JIRA_HOST;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing required env vars: JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN");
  process.exit(1);
}

const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

async function jiraFetch(path, options = {}) {
  const url = `${JIRA_HOST}/rest/api/3${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${AUTH}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Jira API ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "jira",
  version: "1.0.0",
});

// ── Tool: Search Issues (JQL) ────────────────────────────────────────────────

server.tool(
  "search_issues",
  "Search Jira issues using JQL. Returns key, summary, status, assignee, and priority.",
  {
    jql: z.string().describe("JQL query, e.g. 'project = PROJ AND status = \"In Progress\"'"),
    maxResults: z.number().optional().default(20).describe("Max results to return (default 20)"),
  },
  async ({ jql, maxResults }) => {
    const data = await jiraFetch(
      `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,assignee,priority,issuetype,created,updated`
    );
    const issues = data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      assignee: issue.fields.assignee?.displayName || "Unassigned",
      priority: issue.fields.priority?.name,
      type: issue.fields.issuetype?.name,
      created: issue.fields.created,
      updated: issue.fields.updated,
    }));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ total: data.total, issues }, null, 2),
        },
      ],
    };
  }
);

// ── Tool: Get Issue ──────────────────────────────────────────────────────────

server.tool(
  "get_issue",
  "Get full details of a Jira issue by key (e.g. PROJ-123).",
  {
    issueKey: z.string().describe("Issue key, e.g. PROJ-123"),
  },
  async ({ issueKey }) => {
    const issue = await jiraFetch(`/issue/${issueKey}`);
    const fields = issue.fields;
    const result = {
      key: issue.key,
      summary: fields.summary,
      description: fields.description,
      status: fields.status?.name,
      assignee: fields.assignee?.displayName || "Unassigned",
      reporter: fields.reporter?.displayName,
      priority: fields.priority?.name,
      type: fields.issuetype?.name,
      project: fields.project?.name,
      labels: fields.labels,
      created: fields.created,
      updated: fields.updated,
      components: fields.components?.map((c) => c.name),
      fixVersions: fields.fixVersions?.map((v) => v.name),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: Create Issue ───────────────────────────────────────────────────────

server.tool(
  "create_issue",
  "Create a new Jira issue. Returns the created issue key.",
  {
    projectKey: z.string().describe("Project key, e.g. PROJ"),
    summary: z.string().describe("Issue title/summary"),
    description: z.string().optional().describe("Issue description (plain text)"),
    issueType: z.string().optional().default("Task").describe("Issue type: Task, Bug, Story, Epic"),
    priority: z.string().optional().describe("Priority: Highest, High, Medium, Low, Lowest"),
    assigneeEmail: z.string().optional().describe("Assignee email address"),
    labels: z.array(z.string()).optional().describe("Labels to add"),
  },
  async ({ projectKey, summary, description, issueType, priority, assigneeEmail, labels }) => {
    const body = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType },
      },
    };
    if (description) {
      body.fields.description = {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
      };
    }
    if (priority) body.fields.priority = { name: priority };
    if (labels) body.fields.labels = labels;
    if (assigneeEmail) {
      // Look up user by email
      const users = await jiraFetch(`/user/search?query=${encodeURIComponent(assigneeEmail)}`);
      if (users.length > 0) body.fields.assignee = { accountId: users[0].accountId };
    }

    const created = await jiraFetch("/issue", { method: "POST", body: JSON.stringify(body) });
    return {
      content: [{ type: "text", text: JSON.stringify({ key: created.key, id: created.id, self: created.self }, null, 2) }],
    };
  }
);

// ── Tool: Update Issue ───────────────────────────────────────────────────────

server.tool(
  "update_issue",
  "Update fields on an existing Jira issue.",
  {
    issueKey: z.string().describe("Issue key, e.g. PROJ-123"),
    summary: z.string().optional().describe("New summary"),
    description: z.string().optional().describe("New description (plain text)"),
    status: z.string().optional().describe("Transition to this status name (e.g. 'In Progress', 'Done')"),
    assigneeEmail: z.string().optional().describe("New assignee email"),
    priority: z.string().optional().describe("New priority"),
    labels: z.array(z.string()).optional().describe("Replace labels"),
  },
  async ({ issueKey, summary, description, status, assigneeEmail, priority, labels }) => {
    const fields = {};
    if (summary) fields.summary = summary;
    if (description) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
      };
    }
    if (priority) fields.priority = { name: priority };
    if (labels) fields.labels = labels;
    if (assigneeEmail) {
      const users = await jiraFetch(`/user/search?query=${encodeURIComponent(assigneeEmail)}`);
      if (users.length > 0) fields.assignee = { accountId: users[0].accountId };
    }

    if (Object.keys(fields).length > 0) {
      await jiraFetch(`/issue/${issueKey}`, { method: "PUT", body: JSON.stringify({ fields }) });
    }

    // Handle status transition
    if (status) {
      const transitions = await jiraFetch(`/issue/${issueKey}/transitions`);
      const target = transitions.transitions.find(
        (t) => t.name.toLowerCase() === status.toLowerCase()
      );
      if (target) {
        await jiraFetch(`/issue/${issueKey}/transitions`, {
          method: "POST",
          body: JSON.stringify({ transition: { id: target.id } }),
        });
      }
    }

    return {
      content: [{ type: "text", text: `Updated ${issueKey} successfully.` }],
    };
  }
);

// ── Tool: Add Comment ────────────────────────────────────────────────────────

server.tool(
  "add_comment",
  "Add a comment to a Jira issue.",
  {
    issueKey: z.string().describe("Issue key, e.g. PROJ-123"),
    body: z.string().describe("Comment text"),
  },
  async ({ issueKey, body: commentBody }) => {
    const adf = {
      body: {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: commentBody }] }],
      },
    };
    const result = await jiraFetch(`/issue/${issueKey}/comment`, {
      method: "POST",
      body: JSON.stringify(adf),
    });
    return {
      content: [{ type: "text", text: `Comment added to ${issueKey} (id: ${result.id}).` }],
    };
  }
);

// ── Tool: List Projects ──────────────────────────────────────────────────────

server.tool(
  "list_projects",
  "List all Jira projects accessible to the authenticated user.",
  {},
  async () => {
    const data = await jiraFetch("/project/search?maxResults=50");
    const projects = data.values.map((p) => ({
      key: p.key,
      name: p.name,
      lead: p.lead?.displayName,
      style: p.style,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
    };
  }
);

// ── Tool: Get Sprint Issues ──────────────────────────────────────────────────

server.tool(
  "get_sprint_issues",
  "Get issues in the current active sprint for a board.",
  {
    boardId: z.number().describe("Board ID (find via Jira board URL)"),
  },
  async ({ boardId }) => {
    const url = `${JIRA_HOST}/rest/agile/1.0/board/${boardId}/sprint?state=active`;
    const sprintRes = await fetch(url, {
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    });
    const sprintData = await sprintRes.json();
    const activeSprint = sprintData.values?.[0];

    if (!activeSprint) {
      return { content: [{ type: "text", text: "No active sprint found for this board." }] };
    }

    const issuesUrl = `${JIRA_HOST}/rest/agile/1.0/sprint/${activeSprint.id}/issue?maxResults=50&fields=summary,status,assignee,priority,issuetype,story_points`;
    const issuesRes = await fetch(issuesUrl, {
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    });
    const issuesData = await issuesRes.json();

    const issues = issuesData.issues.map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status?.name,
      assignee: i.fields.assignee?.displayName || "Unassigned",
      type: i.fields.issuetype?.name,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { sprint: activeSprint.name, goal: activeSprint.goal, issues },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: Bulk Create Issues ─────────────────────────────────────────────────

server.tool(
  "bulk_create_issues",
  "Create multiple Jira issues at once. Useful for sprint planning or importing a backlog.",
  {
    projectKey: z.string().describe("Project key"),
    issues: z.array(
      z.object({
        summary: z.string(),
        description: z.string().optional(),
        issueType: z.string().optional().default("Task"),
        priority: z.string().optional(),
        labels: z.array(z.string()).optional(),
      })
    ).describe("Array of issues to create"),
  },
  async ({ projectKey, issues }) => {
    const results = [];
    for (const issue of issues) {
      const body = {
        fields: {
          project: { key: projectKey },
          summary: issue.summary,
          issuetype: { name: issue.issueType || "Task" },
        },
      };
      if (issue.description) {
        body.fields.description = {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: issue.description }] }],
        };
      }
      if (issue.priority) body.fields.priority = { name: issue.priority };
      if (issue.labels) body.fields.labels = issue.labels;

      try {
        const created = await jiraFetch("/issue", { method: "POST", body: JSON.stringify(body) });
        results.push({ key: created.key, summary: issue.summary, status: "created" });
      } catch (err) {
        results.push({ summary: issue.summary, status: "failed", error: err.message });
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ── Start Server ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
