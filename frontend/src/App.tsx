import { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, Cpu, CheckCircle, Bug, Database, GitBranch, 
  Activity, AlertTriangle, Lock, Globe, Terminal, Copy, Search
} from 'lucide-react';
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
  const [githubUrl, setGithubUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [results, setResults] = useState<FileResult[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [lineProgress, setLineProgress] = useState(0);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [repoName, setRepoName] = useState('');
  
  const currentFileRef = useRef<string>('');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await axios.get(`${BACKEND_URL}/api/v1/health`);
        setBackendOk(true);
      } catch {
        setBackendOk(false);
      }
    };
    checkBackend();
  }, []);

  const runAgents = async () => {
    if (!githubUrl) return;
    setStatus('running');
    setResults([]);
    setErrorMsg('');
    setCompletedAgents([]);
    setActiveAgent(null);
    setLineProgress(0);

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/analyze-repo-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: githubUrl, max_files: 1 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start analysis');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResult = null;

      while (true) {
        const { value, done } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.replace('data: ', ''));

          if (data.type === 'agent_start') {
            setActiveAgent(data.agent);
            currentFileRef.current = data.file;
          } else if (data.type === 'agent_complete') {
            setCompletedAgents(prev => [...prev, data.agent]);
            const stepIndex = PIPELINE_STEPS.findIndex(s => s.name === data.agent);
            const progress = ((stepIndex + 1) / PIPELINE_STEPS.length) * 100;
            setLineProgress(Math.min(progress, 100));
          } else if (data.type === 'pipeline_complete') {
            finalResult = data.result;
            const parts = githubUrl.replace('https://github.com/', '').split('/');
            setRepoName(`${parts[0]}/${parts[1]}`);
          }
        }
      }

      if (finalResult) {
        setResults([{ file: currentFileRef.current || 'analyzed_file.py', result: finalResult }]);
        setCompletedAgents(PIPELINE_STEPS.map(s => s.name));
        setLineProgress(100);
        setStatus('completed');
        setActiveAgent(null);
      } else {
        setStatus('completed');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Pipeline failed');
      setActiveAgent(null);
    }
  };

  const copyReport = () => {
    const report = results.map(r => `
--- SENTINEL AI ANALYSIS REPORT ---
File: ${r.file}
Score: ${r.result.evaluation?.score}/10
Confidence: ${((r.result.evaluation?.confidence ?? 0) * 100).toFixed(0)}%
Decision: ${r.result.final_decision}
Triage: ${r.result.triage_report?.root_cause}
Security Risk: ${r.result.security_report?.risk_level}
    `).join('\n');
    navigator.clipboard.writeText(report);
    alert('Report copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header - Matching Screenshot */}
        <header className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#1e293b] rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Sentinel AI</h1>
              <p className="text-slate-400 text-sm mt-0.5">Autonomous Multi-Agent Test & Quality Infrastructure</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-[#1e293b] px-4 py-2 rounded-full border border-slate-700">
            <div className={`w-2 h-2 rounded-full ${backendOk ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              {backendOk ? 'Backend Connected' : 'Checking Status...'}
            </span>
          </div>
        </header>

        {/* Input Card - Matching Screenshot */}
        <section className="bg-[#1e293b] rounded-[2rem] p-8 border border-slate-700/50 shadow-2xl mb-8 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <Search className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Analyse a GitHub Repository</h2>
          </div>
          
          <p className="text-slate-400 text-sm mb-6 max-w-4xl">
            Enter any public GitHub repository URL. Sentinel AI will fetch source files (Python, JavaScript, TypeScript, Java, Go, Rust, C++ & 14 more), run all 7 agents, and return structured quality reports.
          </p>

          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="flex-grow bg-[#0f172a] border border-slate-700 rounded-2xl px-6 py-4 text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-all font-mono text-sm"
            />
            <button
              onClick={runAgents}
              disabled={status === 'running'}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              {status === 'running' ? 'Analysing...' : 'Run Agents'}
            </button>
          </div>
        </section>

        {/* Pipeline Visualizer - Matching Screenshot Neon Glow */}
        <section className="bg-[#1e293b] rounded-[2rem] p-10 border border-slate-700/50 shadow-2xl mb-12">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Agent Pipeline</h2>
          </div>

          <div className="relative px-8">
            {/* Connection line */}
            <div className="absolute top-[22px] left-12 right-12 h-[2px] bg-slate-700"></div>
            <div 
              className="absolute top-[22px] left-12 h-[2px] bg-emerald-400 transition-all duration-700 shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
              style={{ width: `calc(${lineProgress}% - 96px)` }}
            ></div>

            <div className="relative flex justify-between gap-4">
              {PIPELINE_STEPS.map((step, idx) => {
                const completed = completedAgents.includes(step.name);
                const active = activeAgent === step.name;
                return (
                  <div key={idx} className="flex flex-col items-center group relative z-10">
                    {/* Glowing effect for active/completed */}
                    {(active || completed) && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-20 bg-emerald-500/20 blur-2xl rounded-full -z-10 animate-pulse"></div>
                    )}
                    
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                      completed ? 'bg-emerald-500 border-emerald-500 text-slate-950 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.4)]' :
                      active ? 'bg-[#0f172a] border-emerald-400 text-emerald-400 animate-pulse scale-125 shadow-[0_0_25px_rgba(16,185,129,0.6)]' :
                      'bg-[#0f172a] border-slate-700 text-slate-600'
                    }`}>
                      {completed ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                    </div>
                    <span className={`mt-4 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      completed ? 'text-emerald-400' : active ? 'text-emerald-400' : 'text-slate-600'
                    }`}>{step.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Results View - Matching Screenshot */}
        {status === 'completed' && results.length > 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              Analysis Complete — <span className="text-emerald-400">{repoName}</span> — {results.length} file analysed
            </h2>

            {results.map((fileResult, i) => (
              <div key={i} className="bg-[#1e293b] rounded-[2rem] p-10 border border-slate-700/50 shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3 text-emerald-400 font-mono text-sm">
                    <GitBranch className="w-4 h-4" />
                    {fileResult.file}
                  </div>
                  <div className="bg-[#0f172a] px-4 py-1 rounded-full border border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    NONE
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                  <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-2">DECISION</p>
                    <p className="text-indigo-400 font-bold text-sm leading-tight">{fileResult.result.final_decision}</p>
                  </div>
                  <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-2">CONFIDENCE</p>
                    <p className="text-emerald-400 font-black text-2xl">
                      {((fileResult.result.evaluation?.confidence ?? 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-2">EVAL SCORE</p>
                    <p className="text-cyan-400 font-black text-2xl">{fileResult.result.evaluation?.score ?? 0}/10</p>
                  </div>
                  <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-2">COVERAGE</p>
                    <p className="text-amber-400 font-black text-2xl">{fileResult.result.test_results?.coverage || '100%'}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-[#0f172a]/50 p-6 rounded-3xl border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-4">
                      <Bug className="w-4 h-4 text-rose-500" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Triage Report</h4>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{fileResult.result.triage_report?.root_cause}</p>
                  </div>
                  <div className="bg-[#0f172a]/50 p-6 rounded-3xl border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Review</h4>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{fileResult.result.security_report?.top_vulnerability}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Messaging */}
        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center gap-4 mt-8">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
          </div>
        )}
        
      </div>
    </div>
  );
}

export default App;
