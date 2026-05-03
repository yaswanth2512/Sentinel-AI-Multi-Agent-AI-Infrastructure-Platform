import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Cpu, CheckCircle, Bug, Database, GitBranch, Activity, AlertTriangle, Lock } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://sentinel-ai-multi-agent-ai-infrastructure-platfo-production.up.railway.app';

interface FileResult {
  file: string;
  result: {
    parsed_ast?: { functions: string[]; classes: string[]; loc: number };
    triage_report?: { root_cause: string; severity: string; steps_to_reproduce?: string[] };
    security_report?: { vulnerabilities_found: boolean; top_vulnerability: string; risk_level: string };
    evaluation?: { score: number; confidence: number; reasoning: string };
    final_decision?: string;
    test_results?: { passed: number; failed: number; coverage: string };
  };
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    none: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    unknown: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${colors[severity] || colors.unknown}`}>
      {severity.toUpperCase()}
    </span>
  );
}

const PIPELINE_STEPS = [
  { name: 'Parser', icon: GitBranch },
  { name: 'Test Gen', icon: Activity },
  { name: 'Breaker', icon: ShieldAlert },
  { name: 'Execute', icon: Cpu },
  { name: 'Triage', icon: Bug },
  { name: 'Security', icon: Lock },
  { name: 'Evaluate', icon: CheckCircle },
];

function App() {
  const [githubUrl, setGithubUrl] = useState('https://github.com/yaswanth2512/Sentinel-AI');
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [results, setResults] = useState<FileResult[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [repoName, setRepoName] = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<string>('');
  const currentFileRef = useRef<string>('');

  const [showSplash, setShowSplash] = useState(true);
  const [animateSplash, setAnimateSplash] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimateSplash(true), 1500);
    const t2 = setTimeout(() => setShowSplash(false), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/v1/health`)
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  const analyzeRepo = async () => {
    if (!githubUrl.startsWith('https://github.com/')) {
      setErrorMsg('Please enter a valid GitHub URL starting with https://github.com/');
      setStatus('error');
      return;
    }
    setStatus('running');
    setResults([]);
    setErrorMsg('');
    setRepoName('');
    setCompletedAgents([]);
    setActiveAgent(null);
    setCurrentFile('');

    // Extract repo name for display
    const parts = githubUrl.replace('https://github.com/', '').split('/');
    if (parts.length >= 2) setRepoName(`${parts[0]}/${parts[1]}`);

    try {
      // Use SSE streaming endpoint via fetch
      const response = await fetch(`${BACKEND_URL}/api/v1/analyze-repo-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: githubUrl, max_files: 1 }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResult: any = null;
      let buffer = '';

      if (!reader) throw new Error('No response stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'file_start') {
              setCurrentFile(event.file);
              currentFileRef.current = event.file;
              setCompletedAgents([]);
              setActiveAgent('Parser');
            } else if (event.type === 'agent_complete') {
              const stepNames = PIPELINE_STEPS.map(s => s.name);
              // Only track agents that exist in our UI pipeline steps
              if (stepNames.includes(event.agent)) {
                setCompletedAgents(prev => [...prev, event.agent]);
                // Set the NEXT agent as active
                const currentIdx = PIPELINE_STEPS.findIndex(s => s.name === event.agent);
                if (currentIdx < PIPELINE_STEPS.length - 1) {
                  setActiveAgent(PIPELINE_STEPS[currentIdx + 1].name);
                } else {
                  setActiveAgent(null);
                }
              }
            } else if (event.type === 'pipeline_complete') {
              finalResult = event.result;
            } else if (event.type === 'done') {
              // All files processed
            }
          } catch { /* skip malformed lines */ }
        }
      }

      if (finalResult) {
        setResults([{ file: currentFileRef.current || 'analyzed_file.py', result: finalResult }]);
        setStatus('completed');
        setActiveAgent(null);
        // Ensure all visible steps show as completed
        setCompletedAgents(PIPELINE_STEPS.map(s => s.name));
      } else {
        setStatus('completed');
      }

    } catch (err: any) {
      const detail = err?.message || 'Unknown error';
      setErrorMsg(detail);
      setStatus('error');
      setActiveAgent(null);
    }
  };

  const getStepState = (stepName: string): 'completed' | 'active' | 'idle' => {
    if (completedAgents.includes(stepName)) return 'completed';
    if (activeAgent === stepName) return 'active';
    return 'idle';
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto relative">

      {/* Splash Screen */}
      {showSplash && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900 transition-all duration-1000 ease-in-out ${animateSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className={`transition-all duration-1000 ease-in-out transform ${animateSplash ? '-translate-y-full scale-50 opacity-0' : 'translate-y-0 scale-100 opacity-100'}`}>
            <img src="/logo.png" alt="Sentinel AI" className="w-64 h-64 object-contain drop-shadow-2xl animate-pulse" />
          </div>
        </div>
      )}

      <div className={`transition-opacity duration-1000 delay-500 ${showSplash && !animateSplash ? 'opacity-0' : 'opacity-100'}`}>

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/30">
              <img src="/logo.png" alt="Sentinel AI" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Sentinel AI</h1>
              <p className="text-slate-400 text-sm">Autonomous Multi-Agent Test & Quality Infrastructure</p>
            </div>
          </div>

          {/* Backend status indicator */}
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${backendOk === true ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : backendOk === false ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-slate-600 bg-slate-800 text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${backendOk === true ? 'bg-emerald-400 animate-pulse' : backendOk === false ? 'bg-red-400' : 'bg-slate-400'}`}></span>
            {backendOk === true ? 'Backend Connected' : backendOk === false ? 'Backend Offline — Running Locally Only' : 'Checking...'}
          </div>
        </header>

        {/* GitHub URL Input */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
          <div className="flex items-center gap-2 mb-4 text-slate-300">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-lg">Analyse a GitHub Repository</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Enter any public GitHub repository URL. Sentinel AI will fetch Python files, run all 7 agents, and return structured quality reports.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={analyzeRepo}
              disabled={status === 'running'}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-medium px-6 py-3 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {status === 'running' ? (
                <><Cpu className="w-5 h-5 animate-spin" /> Analysing...</>
              ) : (
                <><ShieldAlert className="w-5 h-5" /> Run Agents</>
              )}
            </button>
          </div>
          {backendOk === false && (
            <p className="text-amber-400 text-xs mt-3 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Backend is not reachable. Deploy the backend to Railway/Render with your NVIDIA_API_KEY, or run it locally with <code className="bg-slate-900 px-1 rounded">uvicorn main:app --reload</code> from the backend folder.
            </p>
          )}
        </div>

        {/* Pipeline Progress — Real-time animated */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-slate-300">Agent Pipeline</h2>
            {currentFile && status === 'running' && (
              <span className="text-xs text-slate-400 font-mono">Analysing: {currentFile}</span>
            )}
          </div>
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-6 left-0 w-full h-0.5 bg-slate-700 hidden sm:block"></div>
            {/* Animated progress line */}
            <div
              className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 hidden sm:block transition-all duration-700 ease-out"
              style={{
                width: `${Math.min((completedAgents.length / PIPELINE_STEPS.length) * 100, 100)}%`,
              }}
            ></div>

            <div className="flex flex-col sm:flex-row justify-between relative z-10 gap-4 sm:gap-0">
              {PIPELINE_STEPS.map((step, idx) => {
                const state = getStepState(step.name);
                return (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500
                      ${state === 'completed'
                        ? 'bg-emerald-500 border-emerald-400/30 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        : state === 'active'
                        ? 'bg-slate-800 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}>
                      {state === 'completed' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={`text-xs font-medium transition-colors duration-300 ${
                      state === 'completed' ? 'text-emerald-400' :
                      state === 'active' ? 'text-amber-400' :
                      'text-slate-500'
                    }`}>{step.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Error State — Informative Messages */}
        {status === 'error' && (
          <div className={`rounded-2xl p-6 mb-6 border ${
            errorMsg.includes('No Python files') 
              ? 'bg-amber-500/10 border-amber-500/30' 
              : errorMsg.includes('Could not access')
              ? 'bg-indigo-500/10 border-indigo-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {errorMsg.includes('No Python files') ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <p className="font-semibold text-amber-400">No Analysable Python Files Found</p>
                </div>
                <p className="text-slate-300 text-sm mb-3">
                  The repository was scanned successfully, but it does not contain any standalone <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300">.py</code> files. 
                  Sentinel AI currently analyses Python source files only.
                </p>
                <p className="text-slate-400 text-xs">
                  Common reasons: the repo contains only Jupyter Notebooks (<code className="text-slate-300">.ipynb</code>), JavaScript, or data files. 
                  Try a Python-based repo like <button onClick={() => setGithubUrl('https://github.com/pallets/flask')} className="text-emerald-400 underline hover:text-emerald-300">pallets/flask</button> or <button onClick={() => setGithubUrl('https://github.com/tiangolo/fastapi')} className="text-emerald-400 underline hover:text-emerald-300">tiangolo/fastapi</button>.
                </p>
              </>
            ) : errorMsg.includes('Could not access') ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  <p className="font-semibold text-indigo-400">Repository Not Accessible</p>
                </div>
                <p className="text-slate-300 text-sm">
                  The GitHub repository could not be reached. Make sure the URL is correct and the repository is <strong>public</strong>. Private repositories require a GitHub token.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <p className="font-semibold text-red-400">Pipeline Error</p>
                </div>
                <p className="text-slate-300 text-sm">{errorMsg}</p>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {status === 'completed' && results.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-slate-300 font-semibold text-lg">
              Analysis Complete — <span className="text-emerald-400">{repoName}</span> — {results.length} file{results.length > 1 ? 's' : ''} analysed
            </h2>
            {results.map((fileResult, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono text-emerald-300 text-sm">{fileResult.file}</span>
                  </div>
                  {fileResult.result.triage_report && (
                    <SeverityBadge severity={fileResult.result.triage_report.severity} />
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Decision</p>
                    <p className="text-indigo-400 font-semibold text-sm">{fileResult.result.final_decision || 'n/a'}</p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Confidence</p>
                    <p className="text-emerald-400 font-semibold text-xl">
                      {((fileResult.result.evaluation?.confidence ?? 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Eval Score</p>
                    <p className="text-cyan-400 font-semibold text-xl">{fileResult.result.evaluation?.score ?? 0}/10</p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Coverage</p>
                    <p className="text-amber-400 font-semibold text-xl">{fileResult.result.test_results?.coverage ?? 'n/a'}</p>
                  </div>
                </div>

                {/* Triage */}
                {fileResult.result.triage_report && (
                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 mb-4">
                    <div className="flex items-center gap-2 mb-2 text-slate-300">
                      <Bug className="w-4 h-4 text-rose-400" />
                      <span className="font-medium text-sm">Triage Report</span>
                    </div>
                    <p className="text-slate-300 text-sm">{fileResult.result.triage_report.root_cause}</p>
                    {fileResult.result.evaluation?.reasoning && (
                      <p className="text-slate-500 text-xs mt-2 italic">Reasoning: {fileResult.result.evaluation.reasoning}</p>
                    )}
                  </div>
                )}

                {/* Security */}
                {fileResult.result.security_report && (
                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2 text-slate-300">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span className="font-medium text-sm">Security Review</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${fileResult.result.security_report.vulnerabilities_found ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {fileResult.result.security_report.risk_level.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm">{fileResult.result.security_report.top_vulnerability}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* System Stats Footer */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Active Agents', value: '7 Nodes', icon: Database },
            { label: 'LLM Backend', value: 'NVIDIA NIM / Ollama', icon: Cpu },
            { label: 'Memory', value: 'ChromaDB RAG', icon: Activity },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
              <stat.icon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-slate-500 text-xs">{stat.label}</p>
                <p className="text-emerald-400 font-mono text-sm">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default App;
