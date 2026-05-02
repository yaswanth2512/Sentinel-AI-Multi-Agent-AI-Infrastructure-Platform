import { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Cpu, CheckCircle, Bug, Database, GitBranch } from 'lucide-react';
import axios from 'axios';

function App() {
  const [code, setCode] = useState("def add(a, b):\n    return a + b");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<any>(null);
  
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [animateSplash, setAnimateSplash] = useState(false);

  useEffect(() => {
    // Start the transition sequence after a brief delay
    const timer1 = setTimeout(() => {
      setAnimateSplash(true);
    }, 1500);

    // Completely remove the overlay after transition finishes
    const timer2 = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const analyzeCode = async () => {
    setStatus("running");
    try {
      const response = await axios.post("http://localhost:8000/api/v1/analyze", {
        code_content: code,
        file_path: "math_utils.py"
      });
      // Mocking pipeline complete after 3 seconds for UI purpose if we don't poll
      setTimeout(() => {
        setStatus("completed");
        setResult({
          confidence: 0.85,
          decision: "auto-create bug",
          score: 8.5,
          triage: "Off-by-one error suspected"
        });
      }, 3000);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto relative overflow-hidden">
      
      {/* Splash Screen Overlay */}
      {showSplash && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900 transition-all duration-1000 ease-in-out ${
            animateSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className={`transition-all duration-1000 ease-in-out transform ${
            animateSplash ? '-translate-y-full scale-50 opacity-0' : 'translate-y-0 scale-100 opacity-100'
          }`}>
            <img src="/logo.png" alt="Sentinel AI Logo" className="w-64 h-64 object-contain drop-shadow-2xl animate-pulse" />
          </div>
        </div>
      )}

      {/* Main App Content - Fades in */}
      <div className={`transition-opacity duration-1000 delay-500 ${showSplash && !animateSplash ? 'opacity-0' : 'opacity-100'}`}>
        <header className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-emerald-500/30">
            <img src="/logo.png" alt="Sentinel AI Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              Sentinel AI
            </h1>
            <p className="text-slate-400">Autonomous Multi-Agent Test & Quality Infrastructure</p>
          </div>
        </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Input */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <div className="flex items-center gap-2 mb-4 text-slate-300">
              <GitBranch className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-lg">Code Submission</h2>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              spellCheck="false"
            />
            <button
              onClick={analyzeCode}
              disabled={status === "running"}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2"
            >
              {status === "running" ? (
                <><Cpu className="w-5 h-5 animate-pulse" /> Analyzing Pipeline...</>
              ) : (
                <><ShieldAlert className="w-5 h-5" /> Run Sentinel Agents</>
              )}
            </button>
          </div>
          
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
             <div className="flex items-center gap-2 mb-4 text-slate-300">
              <Database className="w-5 h-5 text-rose-400" />
              <h2 className="font-semibold text-lg">System Metrics</h2>
            </div>
            <div className="space-y-4">
               <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-700">
                 <span className="text-slate-400 text-sm">Active Agents</span>
                 <span className="text-emerald-400 font-mono">6 Nodes</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-700">
                 <span className="text-slate-400 text-sm">ChromaDB Memories</span>
                 <span className="text-emerald-400 font-mono">1,402 Vectors</span>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column - Pipeline & Results */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="font-semibold text-lg text-slate-300 mb-6">Agent Pipeline Execution</h2>
            <div className="relative">
              {/* Pipeline Track */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -translate-y-1/2 rounded-full hidden sm:block"></div>
              
              <div className="flex flex-col sm:flex-row justify-between relative z-10 gap-4 sm:gap-0">
                {[
                  { name: 'Parser', icon: GitBranch },
                  { name: 'Test Gen', icon: Activity },
                  { name: 'Breaker', icon: ShieldAlert },
                  { name: 'Execute', icon: Cpu },
                  { name: 'Triage', icon: Bug },
                  { name: 'Evaluate', icon: CheckCircle }
                ].map((step, idx) => {
                  // Simulate progress
                  const isActive = status === 'running';
                  const isDone = status === 'completed';
                  return (
                    <div key={idx} className="flex flex-col items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500
                        ${isDone ? 'bg-emerald-500 border-emerald-400/30 text-white' : 
                          isActive ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 
                          'bg-slate-800 border-slate-700 text-slate-500'}`}
                        style={{ animationDelay: `${idx * 0.2}s`, animation: isActive ? 'pulse 2s infinite' : 'none' }}
                      >
                        <step.icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-medium ${isDone || isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {step.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {status === "completed" && result && (
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl animate-fade-in">
              <h2 className="font-semibold text-lg text-slate-300 mb-6 flex items-center gap-2">
                <CheckCircle className="text-emerald-400" /> Evaluation Results
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Decision</p>
                  <p className="text-indigo-400 font-semibold">{result.decision}</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Confidence</p>
                  <p className="text-emerald-400 font-semibold text-xl">{(result.confidence * 100).toFixed(0)}%</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Eval Score</p>
                  <p className="text-cyan-400 font-semibold text-xl">{result.score}/10</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Root Cause</p>
                  <p className="text-rose-400 text-sm truncate" title={result.triage}>{result.triage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default App;
