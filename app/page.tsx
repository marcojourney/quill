"use client"; 
import { useState } from "react";
import {
  Server,
  Terminal,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  GitBranch,
  Layers,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Database,
  Bot,
  Ban,
  Loader2,
  Send,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

const MERGE_REQUESTS = [
  {
    id: "MR-2031",
    title: "Add account balance lookup endpoint",
    author: "J. Okafor",
    sourceBranch: "feature/balance-lookup",
    targetBranch: "main",
    filesChanged: 4,
    status: "critical",
    diffFile: "src/accounts/accounts.service.ts",
    diff: [
      { line: 38, code: "async function getAccountById(req: Request) {", kind: "context" },
      { line: 39, code: "  const id = req.params.id;", kind: "context" },
      { line: 40, code: "- return db.query(`SELECT * FROM accounts WHERE id = ?`, [id]);", kind: "removed" },
      { line: 41, code: "+ const query =", kind: "added" },
      { line: 42, code: "    \"SELECT * FROM accounts WHERE id = '\" + id + \"'\";", kind: "flagged" },
      { line: 43, code: "+ return db.raw(query);", kind: "added" },
      { line: 44, code: "}", kind: "context" },
    ],
    findingRuleId: "SEC-04",
    findingTitle: "Potential SQL Injection",
    findingLine: 42,
    aiComment:
      "Flagging a potential SQL injection on line 42 — `id` is concatenated directly into the query string. Recommend reverting to the parameterized query removed above, or using SafeQueryBuilder.where('id', id). Blocking per SEC-04 until resolved.",
  },
  {
    id: "MR-1987",
    title: "Refactor transaction logging middleware",
    author: "S. Petrova",
    sourceBranch: "fix/txn-logging",
    targetBranch: "release/2.4",
    filesChanged: 2,
    status: "passed",
    diffFile: "src/transactions/logging.middleware.ts",
    diff: [
      { line: 12, code: "function logTransaction(txn: Transaction) {", kind: "context" },
      { line: 13, code: "- console.log(txn);", kind: "removed" },
      { line: 14, code: "+ logger.audit(redactPan(txn));", kind: "added" },
      { line: 15, code: "}", kind: "context" },
    ],
    aiComment:
      "No blocking findings. Transaction payloads are now redacted via redactPan() before logging, satisfying AUDIT-07. Approved — nice catch removing the raw console.log.",
  },
];

const RULEBOOK = [
  { id: "SEC-04", label: "Parameterized queries enforced for all DB access", status: "fail" },
  { id: "SEC-02", label: "No hardcoded secrets or credentials in diff", status: "pass" },
  { id: "AUDIT-07", label: "PII and PAN fields redacted before logging", status: "pass" },
  { id: "CONV-11", label: "Commit messages follow conventional format", status: "pass" },
  { id: "SEC-09", label: "Third-party dependencies scanned for known CVEs", status: "pending" },
];

const STATUS_STYLES = {
  critical: {
    label: "Critical Vulnerability",
    className: "border-rose-800 bg-rose-950 text-rose-400",
    icon: ShieldAlert,
  },
  passed: {
    label: "Conventions Passed",
    className: "border-emerald-800 bg-emerald-950 text-emerald-400",
    icon: ShieldCheck,
  },
};

const RULE_STYLES = {
  pass: { icon: CheckCircle2, className: "text-emerald-400" },
  fail: { icon: XCircle, className: "text-rose-400" },
  pending: { icon: Clock, className: "text-amber-400" },
};

const DIFF_LINE_STYLES = {
  context: "text-zinc-500",
  added: "bg-emerald-950 text-emerald-300",
  removed: "text-zinc-600 line-through",
  flagged: "border-l-2 border-rose-500 bg-rose-950 text-rose-200",
};

function StatusBadge({ status }) {
  const { label, className, icon: Icon } = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function McpStatusBar({ isSyncing, onSync }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 bg-slate-950 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3 overflow-hidden">
        <Server className="hidden h-4 w-4 shrink-0 text-zinc-500 sm:block" />
        <div className="flex items-center gap-2 overflow-hidden text-sm">
          <span className="shrink-0 font-medium text-zinc-100">NestJS MCP Server</span>
          <span className="hidden text-zinc-600 sm:inline">·</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <Terminal className="h-3 w-3" />
                Connected via stdio
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-xs">
              Local stdio transport — no network egress
            </TooltipContent>
          </Tooltip>
        </div>
        <Badge
          variant="outline"
          className="hidden truncate border-zinc-700 font-mono text-xs text-zinc-500 md:inline-flex"
        >
          gitlab.bank.internal
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-xs text-zinc-500 lg:inline">Agent: code-review-v2</span>
        <Button
          size="sm"
          variant="outline"
          onClick={onSync}
          className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing…" : "Sync GitLab"}
        </Button>
      </div>
    </header>
  );
}

function MrCard({ mr, active, onSelect }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`cursor-pointer border transition-colors ${
        active
          ? "border-emerald-500 bg-zinc-900"
          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
      }`}
    >
      <CardHeader className="space-y-2 p-4 pb-3">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="font-mono">{mr.id}</span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {mr.filesChanged} files
          </span>
        </div>
        <CardTitle className="text-sm font-medium leading-snug text-zinc-100">
          {mr.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <StatusBadge status={mr.status} />
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <User className="h-3 w-3" />
            {mr.author}
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <GitBranch className="h-3 w-3" />
            {mr.targetBranch}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function MrSidebar({ mergeRequests, activeMrId, onSelect }) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-zinc-800 bg-zinc-950 md:h-full md:w-80 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Active Merge Requests
        </h2>
        <Badge variant="outline" className="border-zinc-700 text-xs text-zinc-500">
          {mergeRequests.length}
        </Badge>
      </div>
      <ScrollArea className="h-56 md:h-full">
        <div className="flex flex-col gap-3 px-4 pb-4">
          {mergeRequests.map((mr) => (
            <MrCard key={mr.id} mr={mr} active={mr.id === activeMrId} onSelect={() => onSelect(mr)} />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function DiffViewer({ mr, dismissed }) {
  const hadFinding = Boolean(mr.findingRuleId);
  const hasActiveFinding = hadFinding && !dismissed;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <span className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          <FileText className="h-3.5 w-3.5 text-zinc-500" />
          {mr.diffFile}
        </span>
        <span className="hidden font-mono text-xs text-zinc-600 sm:inline">
          {mr.sourceBranch} → {mr.targetBranch}
        </span>
      </div>

      <div className="font-mono text-xs leading-relaxed">
        {mr.diff.map((row) => (
          <div key={row.line}>
            <div className="flex">
              <div
                className={`flex w-12 shrink-0 select-none items-center justify-end border-r border-zinc-800 px-2 text-xs ${
                  row.kind === "flagged" ? "text-rose-400" : "text-zinc-600"
                }`}
              >
                {row.line}
              </div>
              <div className={`flex-1 overflow-x-auto whitespace-pre px-3 py-1 ${DIFF_LINE_STYLES[row.kind]}`}>
                {row.code}
              </div>
            </div>

            {row.kind === "flagged" && hasActiveFinding && (
              <div className="border-y border-zinc-800 bg-zinc-950 px-4 py-3 pl-16">
                <div className="mb-2 h-3 w-px bg-rose-700" />
                <Alert variant="destructive" className="border-rose-800 bg-rose-950">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <AlertTitle className="font-mono text-xs tracking-wide text-rose-300">
                    Rule {mr.findingRuleId}: {mr.findingTitle}
                  </AlertTitle>
                  <AlertDescription className="text-rose-300">
                    Line {mr.findingLine} concatenates untrusted input directly into a SQL string.
                    Use a parameterized query or the bank's SafeQueryBuilder to prevent injection.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {row.kind === "flagged" && hadFinding && dismissed && (
              <div className="flex items-center gap-2 border-y border-zinc-800 bg-zinc-900 px-4 py-3 pl-16 text-xs text-zinc-500">
                <Ban className="h-3.5 w-3.5" />
                {mr.findingRuleId} suppressed — marked as false positive by reviewer.
              </div>
            )}
          </div>
        ))}
      </div>

      {!hadFinding && (
        <div className="p-4">
          <Alert className="border-emerald-800 bg-emerald-950">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <AlertTitle className="font-mono text-xs tracking-wide text-emerald-300">
              No blocking findings
            </AlertTitle>
            <AlertDescription className="text-emerald-400">
              All banking compliance rules satisfied for this diff.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

function RulebookChecklist({ rules }) {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-200">Corporate Banking Compliance</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 cursor-help text-zinc-500" />
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">
              resource://bank-rulebook/v3.json
            </TooltipContent>
          </Tooltip>
        </div>
        <Badge variant="outline" className="gap-1.5 border-zinc-700 font-mono text-xs text-zinc-500">
          <Database className="h-3 w-3" />
          MCP Resource
        </Badge>
      </div>
      <ul className="space-y-2">
        {rules.map((rule) => {
          const { icon: Icon, className } = RULE_STYLES[rule.status];
          return (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5"
            >
              <span className="flex items-center gap-2.5 text-sm text-zinc-300">
                <Icon className={`h-4 w-4 shrink-0 ${className}`} />
                {rule.label}
              </span>
              <span className="shrink-0 font-mono text-xs text-zinc-600">{rule.id}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActionPanel({ mr, comment, onCommentChange, dismissed, isPosting, posted, onPush, onDismiss }) {
  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Bot className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Human-in-the-Loop Review
        </span>
        <span className="font-mono text-xs text-zinc-600">{mr.id}</span>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        disabled={dismissed}
        rows={3}
        placeholder="Edit the AI-drafted comment before posting to GitLab…"
        className="resize-none border-zinc-800 bg-zinc-900 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-emerald-600"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-zinc-600">
          {posted
            ? "Comment posted to GitLab"
            : dismissed
              ? "Finding dismissed — no comment will be posted"
              : "Reviewed by you before publishing"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
            disabled={dismissed}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Dismiss / False Positive
          </Button>
          <Button
            size="sm"
            onClick={onPush}
            disabled={isPosting || dismissed || comment.trim().length === 0}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {isPosting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Posting…
              </>
            ) : posted ? (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Posted
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Push Comment to GitLab
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

const TAB_BASE = "rounded-none border-b-2 px-0.5 pb-3 pt-3 text-sm font-medium shadow-none bg-transparent";
const TAB_ACTIVE = `${TAB_BASE} border-emerald-500 text-zinc-100`;
const TAB_INACTIVE = `${TAB_BASE} border-transparent text-zinc-500`;

export default function CodeReviewDashboard() {
  const [activeMrId, setActiveMrId] = useState(MERGE_REQUESTS[0].id);
  const activeMr = MERGE_REQUESTS.find((mr) => mr.id === activeMrId) ?? MERGE_REQUESTS[0];

  const [activeTab, setActiveTab] = useState("diff");
  const [comment, setComment] = useState(activeMr.aiComment);
  const [dismissed, setDismissed] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  function selectMr(mr) {
    setActiveMrId(mr.id);
    setComment(mr.aiComment);
    setDismissed(false);
    setPosted(false);
  }

  function handleCommentChange(value) {
    setComment(value);
    if (posted) setPosted(false);
  }

  function handlePush() {
    setIsPosting(true);
    setPosted(false);
    setTimeout(() => {
      setIsPosting(false);
      setPosted(true);
    }, 1400);
  }

  function handleDismiss() {
    setDismissed(true);
    setPosted(false);
  }

  function handleSync() {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="dark flex h-screen w-full flex-col overflow-hidden bg-slate-950 font-sans text-zinc-100 antialiased">
        <McpStatusBar isSyncing={isSyncing} onSync={handleSync} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <MrSidebar mergeRequests={MERGE_REQUESTS} activeMrId={activeMr.id} onSelect={selectMr} />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-zinc-800 px-4">
                <TabsList className="h-auto gap-6 bg-transparent p-0">
                  <TabsTrigger value="diff" className={activeTab === "diff" ? TAB_ACTIVE : TAB_INACTIVE}>
                    Active Diff View
                  </TabsTrigger>
                  <TabsTrigger value="rulebook" className={activeTab === "rulebook" ? TAB_ACTIVE : TAB_INACTIVE}>
                    Bank Rulebook Context
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="diff" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <DiffViewer mr={activeMr} dismissed={dismissed} />
                </ScrollArea>
              </TabsContent>
              <TabsContent value="rulebook" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <RulebookChecklist rules={RULEBOOK} />
                </ScrollArea>
              </TabsContent>
            </Tabs>
            <ActionPanel
              mr={activeMr}
              comment={comment}
              onCommentChange={handleCommentChange}
              dismissed={dismissed}
              isPosting={isPosting}
              posted={posted}
              onPush={handlePush}
              onDismiss={handleDismiss}
            />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}