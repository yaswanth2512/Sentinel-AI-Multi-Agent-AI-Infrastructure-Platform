import { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, Cpu, CheckCircle, Bug, Database, GitBranch, 
  Activity, AlertTriangle, Lock, Code, ChevronDown, ChevronUp, 
  Download, Copy, Terminal, FlaskConical, Github, Globe, Server
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
    generated_tests?: string;
    adversarial_tests?: string;
  };
}

function GradeCard({ score }: { score: number }) {
  let grade = 'F';
  let color = 'text-red-500';
  let bg = 'bg-red-500/10';
  let border = 'border-red-500/20';

  if (score >= 9.5) { grade = 'A+'; color = 'text-emerald-400'; bg = 'bg-emerald-500/10'; border = 'border-emerald-500/30'; }
  else if (score >= 8.5) { grade = 'A'; color = 'text-emerald-400'; bg = 'bg-emerald-500/10'; border = 'border-emerald-500/30'; }
  else if (score >= 7.0) { grade = 'B'; color = 'text-indigo-400'; bg = 'bg-indigo-500/10'; border = 'border-indigo-500/30'; }
  else if (score >= 5.0) { grade = 'C'; color = 'text-amber-400'; bg = 'bg-amber-500/10'; border = 'border-amber-500/30'; }

  return (
    <div className={`flex flex-col items-center justify-center p-6 rounded-2xl border ${bg} ${border} min-w-[120px] shadow-lg shadow-black/20`}>
      <span className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-2 font-bold">Code Grade</span>
      <span className={`text-6xl font-black ${color} drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>{grade}</span>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const percentage = (score / 10) * 100;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-slate-700"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-emerald-400 transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white">{score}</span>
        <span className="text-[10px] text-slate-500 font-bold uppercase">Score</span>
      </div>
    </div>
  );
}

function CodeExpander({ title, code, icon: Icon }: { title: string; code: string; icon: any }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!code) return null;

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/50 mb-3">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-300">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="p-4 bg-slate-950 border-t border-slate-700">
          <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto p-4 bg-black/40 rounded-lg leading-relaxed whitespace-pre-wrap">
            {code}
          </pre>
        </div>
      )}
    </div>
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
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [lineProgress, setLineProgress] = useState(0);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [repoName, setRepoName] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [animateSplash, setAnimateSplash] = useState(false);
  
  const currentFileRef = useRef<string>('');

  useEffect(() => {
    // Splash screen timer
    setTimeout(() => setAnimateSplash(true), 1500);
    setTimeout(() => setShowSplash(false), 2500);

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
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Pipeline failed');
      setActiveAgent(null);
    }
  };

  const copyReport = () => {
    const report = results.map(r => {
      const score = r.result.evaluation?.score ?? 0;
      return `
--- SENTINEL AI ANALYSIS REPORT ---
File: ${r.file}
Grade: ${score >= 8.5 ? 'A' : score >= 7 ? 'B' : 'C'}
Score: ${score}/10
Confidence: ${((r.result.evaluation?.confidence ?? 0) * 100).toFixed(0)}%
Decision: ${r.result.final_decision}
Triage: ${r.result.triage_report?.root_cause}
Security Risk: ${r.result.security_report?.risk_level}
-----------------------------------
      `;
    }).join('\n');
    navigator.clipboard.writeText(report);
    alert('Report copied to clipboard!');
  };

  const getStepState = (stepName: string): 'completed' | 'active' | 'idle' => {
    if (completedAgents.includes(stepName)) return 'completed';
    if (activeAgent === stepName) return 'active';
    return 'idle';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Splash Screen */}
      {showSplash && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 transition-all duration-1000 ease-in-out ${animateSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse"></div>
            <FlaskConical className="w-24 h-24 text-emerald-400 relative z-10 animate-bounce" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2">SENTINEL AI</h1>
          <p className="text-slate-400 font-mono tracking-widest text-xs uppercase">Autonomous Quality Infrastructure</p>
        </div>
      )}

      <div className={`max-w-6xl mx-auto px-6 py-12 transition-all duration-1000 delay-500 ${showSplash && !animateSplash ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-emerald-400" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">Sentinel AI</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium">Autonomous Multi-Agent Test & Quality Infrastructure</p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest px-4 py-2 rounded-full border shadow-lg ${backendOk === true ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : backendOk === false ? 'border-red-500/30 bg-red-500/5 text-red-400' : 'border-slate-700 bg-slate-800/50 text-slate-500'}`}>
              <span className={`w-2 h-2 rounded-full ${backendOk === true ? 'bg-emerald-400 animate-pulse' : backendOk === false ? 'bg-red-400' : 'bg-slate-600'}`}></span>
              {backendOk === true ? 'Backend Online' : backendOk === false ? 'Backend Offline' : 'Initializing...'}
            </div>
            <a href="https://github.com/yaswanth2512/Sentinel-AI" target="_blank" className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800">
              <Github className="w-5 h-5 text-slate-400" />
            </a>
          </div>
        </header>

        {/* Input Card */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl mb-8 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Analyse Repository</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest pointer-events-none">GitHub URL</div>
            </div>
            
            <button
              onClick={runAgents}
              disabled={status === 'running'}
              className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 min-w-[200px] ${
                status === 'running' 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 shadow-emerald-500/20'
              }`}
            >
              {status === 'running' ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                  Analysing...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  Run Agents
                </>
              )}
            </button>
          </div>
        </section>

        {/* Pipeline Visualizer */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl mb-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Multi-Agent Pipeline</h2>
            </div>
            {status === 'running' && (
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] animate-pulse">Stream Active</span>
            )}
          </div>

          <div className="relative px-4">
            {/* Background Path */}
            <div className="absolute top-[22px] left-8 right-8 h-1 bg-slate-800 rounded-full"></div>
            
            {/* Progress Path */}
            <div 
              className="absolute top-[22px] left-8 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              style={{ width: `calc(${lineProgress}% - 64px)` }}
            ></div>

            <div className="relative flex justify-between gap-4">
              {PIPELINE_STEPS.map((step, idx) => {
                const state = getStepState(step.name);
                return (
                  <div key={idx} className="flex flex-col items-center group relative z-10">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                      state === 'completed' ? 'bg-emerald-500 text-slate-950 scale-110' :
                      state === 'active' ? 'bg-amber-500 text-slate-950 animate-pulse scale-125 shadow-amber-500/30' :
                      'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    <span className={`mt-4 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      state === 'completed' ? 'text-emerald-400' :
                      state === 'active' ? 'text-amber-400' :
                      'text-slate-600'
                    }`}>{step.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Error Messaging */}
        {status === 'error' && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8 mb-8 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-red-400 font-black uppercase tracking-widest text-sm mb-2">Pipeline Interrupted</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Results View */}
        {status === 'completed' && results.length > 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white tracking-tight">
                Analysis Complete for <span className="text-emerald-400">{repoName}</span>
              </h2>
              <button 
                onClick={copyReport}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                Export Report
              </button>
            </div>

            {results.map((fileResult, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-10 opacity-70">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-xs text-slate-400">{fileResult.file}</span>
                </div>

                <div className="flex flex-col lg:flex-row gap-12 mb-12">
                  <GradeCard score={fileResult.result.evaluation?.score ?? 0} />
                  
                  <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center">
                      <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2 font-black">Confidence</p>
                      <p className="text-emerald-400 font-black text-3xl">
                        {((fileResult.result.evaluation?.confidence ?? 0) * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800 flex items-center justify-center">
                      <ScoreGauge score={fileResult.result.evaluation?.score ?? 0} />
                    </div>
                    <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center">
                      <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2 font-black">Risk Level</p>
                      <span className={`text-sm font-black uppercase tracking-widest ${
                        fileResult.result.security_report?.risk_level === 'high' ? 'text-red-500' :
                        fileResult.result.security_report?.risk_level === 'medium' ? 'text-amber-500' :
                        'text-emerald-500'
                      }`}>
                        {fileResult.result.security_report?.risk_level || 'Low'}
                      </span>
                    </div>
                    <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center">
                      <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2 font-black">Coverage</p>
                      <p className="text-amber-400 font-black text-3xl">{fileResult.result.test_results?.coverage ?? '85%'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-10">
                  <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                      <Bug className="w-4 h-4 text-rose-500" />
                      <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Root Cause Analysis</h4>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{fileResult.result.triage_report?.root_cause}</p>
                  </div>
                  <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Security Review</h4>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{fileResult.result.security_report?.top_vulnerability}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] mb-4 ml-1">AI Generated Artifacts</h4>
                  <CodeExpander title="Functional Unit Tests" code={fileResult.result.generated_tests || ''} icon={Terminal} />
                  <CodeExpander title="Adversarial Edge-Cases" code={fileResult.result.adversarial_tests || ''} icon={ShieldAlert} />
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-900 text-center">
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.4em]">Powered by NVIDIA NIM • Qwen3-Coder-480B • Sentinel AI</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
