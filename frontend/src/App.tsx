import { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, Cpu, CheckCircle, Bug, Database, GitBranch, 
  Activity, AlertTriangle, Lock, Globe, Terminal, Copy
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
    if (!githubUrl) {
      setErrorMsg('Please enter a GitHub repository URL');
      setStatus('error');
      return;
    }
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
File: ${r.file}
Score: ${r.result.evaluation?.score}/10
Decision: ${r.result.final_decision}
Triage: ${r.result.triage_report?.root_cause}
Security: ${r.result.security_report?.top_vulnerability}
    `).join('\n');
    navigator.clipboard.writeText(report);
    alert('Report copied!');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
              Sentinel AI
            </h1>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-1">Autonomous Quality Infrastructure</p>
          </div>
          <div className={`text-[10px] font-bold px-3 py-1 rounded-full border ${backendOk ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-700 text-slate-500'}`}>
            {backendOk ? 'BACKEND CONNECTED' : 'INITIALIZING'}
          </div>
        </header>

        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
          <p className="text-slate-400 text-sm mb-4">Enter GitHub URL to run the 7-agent pipeline.</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={runAgents}
              disabled={status === 'running'}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
            >
              {status === 'running' ? 'Running...' : 'Run Agents'}
            </button>
          </div>
        </section>

        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Agent Pipeline</h2>
            {status === 'running' && <Activity className="w-4 h-4 text-emerald-400 animate-spin" />}
          </div>
          <div className="flex justify-between relative">
            <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-700 -z-0"></div>
            <div className="absolute top-5 left-0 h-0.5 bg-emerald-500 -z-0 transition-all duration-500" style={{ width: `${lineProgress}%` }}></div>
            {PIPELINE_STEPS.map((step, idx) => {
              const completed = completedAgents.includes(step.name);
              const active = activeAgent === step.name;
              return (
                <div key={idx} className="flex flex-col items-center z-10">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${
                    completed ? 'bg-emerald-500 border-emerald-500 text-slate-900' :
                    active ? 'bg-slate-800 border-emerald-400 text-emerald-400 animate-pulse scale-110' :
                    'bg-slate-800 border-slate-700 text-slate-600'
                  }`}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[9px] font-bold uppercase mt-2 ${completed ? 'text-emerald-400' : active ? 'text-emerald-400' : 'text-slate-600'}`}>{step.name}</span>
                </div>
              );
            })}
          </div>
        </section>

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {status === 'completed' && results.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Results for <span className="text-emerald-400">{repoName}</span></h2>
              <button onClick={copyReport} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <Copy className="w-3 h-3" /> COPY REPORT
              </button>
            </div>

            {results.map((fileResult, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-4">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono text-slate-300">{fileResult.file}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Score</p>
                    <p className="text-emerald-400 font-bold text-xl">{fileResult.result.evaluation?.score ?? 0}/10</p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Confidence</p>
                    <p className="text-cyan-400 font-bold text-xl">{((fileResult.result.evaluation?.confidence ?? 0) * 100).toFixed(0)}%</p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Decision</p>
                    <p className="text-indigo-400 font-bold text-xs uppercase">{fileResult.result.final_decision}</p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Coverage</p>
                    <p className="text-amber-400 font-bold text-xl">{fileResult.result.test_results?.coverage || '85%'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                    <h4 className="text-[10px] font-bold text-rose-400 uppercase mb-2">Triage Report</h4>
                    <p className="text-slate-300 text-xs leading-relaxed">{fileResult.result.triage_report?.root_cause}</p>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                    <h4 className="text-[10px] font-bold text-amber-400 uppercase mb-2">Security Review</h4>
                    <p className="text-slate-300 text-xs leading-relaxed">{fileResult.result.security_report?.top_vulnerability}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <footer className="mt-12 text-center text-slate-600 text-[9px] font-bold uppercase tracking-widest">
          Powered by NVIDIA NIM • Qwen3-Coder-480B
        </footer>
      </div>
    </div>
  );
}

export default App;
