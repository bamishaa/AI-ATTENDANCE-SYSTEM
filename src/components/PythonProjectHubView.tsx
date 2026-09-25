import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Download, 
  FolderTree, 
  FileCode, 
  Copy, 
  Check, 
  Terminal, 
  Layers, 
  ShieldCheck,
  FileText
} from 'lucide-react';

interface ProjectFileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  content?: string;
  size?: number;
  children?: ProjectFileNode[];
}

export const PythonProjectHubView: React.FC = () => {
  const [fileTree, setFileTree] = useState<ProjectFileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFileNode | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/project_files');
      const data = await res.json();
      if (data.files) {
        setFileTree(data.files);
        // Find app.py as default selected file
        const findAppPy = (nodes: ProjectFileNode[]): ProjectFileNode | null => {
          for (const n of nodes) {
            if (n.name === 'app.py') return n;
            if (n.children) {
              const f = findAppPy(n.children);
              if (f) return f;
            }
          }
          return null;
        };
        const appPy = findAppPy(data.files);
        if (appPy) setSelectedFile(appPy);
      }
    } catch (e) {
      console.error('Failed fetching project files:', e);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleDownloadZip = () => {
    setIsDownloading(true);
    window.location.href = '/api/download_project_zip';
    setTimeout(() => setIsDownloading(false), 2000);
  };

  // Render tree item recursively
  const renderTree = (node: ProjectFileNode, depth = 0) => {
    const isSelected = selectedFile?.path === node.path;

    if (node.type === 'dir') {
      return (
        <div key={node.path} className="space-y-0.5">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 text-xs font-semibold hover:bg-slate-800/40 select-none"
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
          >
            <FolderTree className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{node.name}/</span>
          </div>
          {node.children?.map((child) => renderTree(child, depth + 1))}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        onClick={() => setSelectedFile(node)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
          isSelected
            ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-2 border-blue-500'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
        }`}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
          <span className="truncate">{node.name}</span>
        </div>
        {node.size !== undefined && (
          <span className="text-[10px] text-slate-500 font-mono ml-2 shrink-0">
            {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}k` : `${node.size}b`}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-blue-900/30 to-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Code2 className="w-6 h-6 text-indigo-400" />
            Standalone Python + Flask + OpenCV Project
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Complete, self-contained Python Flask codebase matching the requested architecture. Inspect source files or download the full bundle to run locally on your machine with webcam video streaming.
          </p>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={isDownloading}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? 'Preparing ZIP...' : 'Download Project (.ZIP)'}
        </button>
      </div>

      {/* Local Setup Commands Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Quick Local Execution Guide
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">Python 3.9+ / 3.10 / 3.11</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 relative group">
            <div className="text-[11px] text-slate-400 font-medium mb-1">1. Create virtualenv</div>
            <code className="text-xs text-emerald-400 font-mono block select-all">
              python3 -m venv venv && source venv/bin/activate
            </code>
            <button
              onClick={() => copyToClipboard('python3 -m venv venv && source venv/bin/activate', 'cmd1')}
              className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copiedCmd === 'cmd1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 relative group">
            <div className="text-[11px] text-slate-400 font-medium mb-1">2. Install dependencies</div>
            <code className="text-xs text-cyan-400 font-mono block select-all">
              pip install -r requirements.txt
            </code>
            <button
              onClick={() => copyToClipboard('pip install -r requirements.txt', 'cmd2')}
              className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copiedCmd === 'cmd2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 relative group">
            <div className="text-[11px] text-slate-400 font-medium mb-1">3. Launch Flask server</div>
            <code className="text-xs text-indigo-400 font-mono block select-all">
              python app.py
            </code>
            <button
              onClick={() => copyToClipboard('python app.py', 'cmd3')}
              className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copiedCmd === 'cmd3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Code Inspector: File Tree (Left) + Code Viewer (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Left Tree Explorer */}
        <div className="md:col-span-4 border-r border-slate-800 p-4 space-y-3 bg-slate-950/40">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Project Structure
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              ai_attendance_system/
            </span>
          </div>

          <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
            {fileTree.map((node) => renderTree(node))}
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="md:col-span-8 flex flex-col bg-slate-950">
          {/* File Header */}
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-xs font-semibold text-white">
                {selectedFile?.path || 'Select a file'}
              </span>
            </div>

            {selectedFile?.content && (
              <button
                onClick={() => copyToClipboard(selectedFile.content || '', 'code')}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedCmd === 'code' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Code
                  </>
                )}
              </button>
            )}
          </div>

          {/* Code Text Content */}
          <div className="p-4 flex-1 overflow-auto max-h-[560px] font-mono text-xs text-slate-300 leading-relaxed bg-[#0d1117]">
            {selectedFile?.content ? (
              <pre className="whitespace-pre overflow-x-auto select-text font-mono">
                {selectedFile.content}
              </pre>
            ) : (
              <div className="p-12 text-center text-slate-600">
                Select a file from the left sidebar to view its source code.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
