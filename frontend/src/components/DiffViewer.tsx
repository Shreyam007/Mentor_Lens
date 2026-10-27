import { Fragment } from 'react';
import { CommentCard } from './CommentCard';

export interface DiffLine {
  type: 'add' | 'del' | 'context' | 'header';
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface DiffFile {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch: string;
}

interface DiffViewerProps {
  files: DiffFile[];
  findings?: any[];
  onOpenFinding?: (finding: any) => void;
}

export function parseDiff(patch: string): DiffLine[] {
  if (!patch) return [];
  const lines = patch.split('\n');
  const result: DiffLine[] = [];
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      result.push({
        type: 'add',
        newLine: newLineNum,
        content: line.slice(1),
      });
      newLineNum++;
    } else if (line.startsWith('-')) {
      result.push({
        type: 'del',
        oldLine: oldLineNum,
        content: line.slice(1),
      });
      oldLineNum++;
    } else {
      result.push({
        type: 'context',
        oldLine: oldLineNum,
        newLine: newLineNum,
        content: line.startsWith(' ') ? line.slice(1) : line,
      });
      oldLineNum++;
      newLineNum++;
    }
  }

  return result;
}

export function DiffViewer({ files, findings = [] }: DiffViewerProps) {
  return (
    <div className="space-y-6">
      {files.map((file, fileIdx) => {
        const diffLines = parseDiff(file.patch);
        const fileFindings = findings.filter(
          (f) => f.file_path === file.filename || (!f.file_path && fileIdx === 0)
        );

        return (
          <div
            key={file.filename || fileIdx}
            className="bg-surface border-3 border-ink rounded-xl shadow-brutal overflow-hidden"
          >
            {/* File Header */}
            <div className="p-3 bg-surface-2 border-b-2 border-ink flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-ink bg-surface px-2 py-0.5 border-2 border-ink rounded">
                  {file.filename}
                </span>
                {file.status && (
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-mint/20 border border-ink/40 rounded">
                    {file.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                {file.additions !== undefined && (
                  <span className="text-mint font-bold">+{file.additions}</span>
                )}
                {file.deletions !== undefined && (
                  <span className="text-coral font-bold">-{file.deletions}</span>
                )}
              </div>
            </div>

            {/* Diff Lines Table */}
            <div className="overflow-x-auto font-mono text-xs">
              <div className="min-w-[640px]">
                {diffLines.map((line, lineIdx) => {
                  const matchingFindings = fileFindings.filter(
                    (f) => f.line_start === line.newLine && line.type !== 'header'
                  );

                  let rowBg = 'hover:bg-sand/20';
                  let prefix = ' ';
                  if (line.type === 'header') {
                    rowBg = 'bg-cobalt/10 text-cobalt font-semibold border-y border-cobalt/20';
                    prefix = '';
                  } else if (line.type === 'add') {
                    rowBg = 'bg-mint/15 text-ink';
                    prefix = '+';
                  } else if (line.type === 'del') {
                    rowBg = 'bg-coral/15 text-ink';
                    prefix = '-';
                  }

                  return (
                    <Fragment key={lineIdx}>
                      <div className={`flex items-stretch border-b border-ink/5 ${rowBg}`}>
                        {/* Old Line # */}
                        <div className="w-12 select-none text-right pr-2 text-muted/60 py-0.5 border-r border-ink/10">
                          {line.oldLine ?? ''}
                        </div>
                        {/* New Line # */}
                        <div className="w-12 select-none text-right pr-2 text-muted/60 py-0.5 border-r border-ink/10">
                          {line.newLine ?? ''}
                        </div>
                        {/* Marker */}
                        <div className="w-6 select-none text-center py-0.5 font-bold opacity-60">
                          {prefix}
                        </div>
                        {/* Code content */}
                        <div className="flex-1 py-0.5 pr-4 whitespace-pre font-mono overflow-x-visible">
                          {line.content}
                        </div>
                      </div>

                      {/* Inline MentorLens Finding Comment Card */}
                      {matchingFindings.map((finding) => (
                        <div
                          key={finding.id}
                          className="p-4 bg-sand/30 border-y-2 border-dashed border-ink my-1"
                        >
                          <div className="max-w-3xl ml-12">
                            <CommentCard finding={finding} />
                          </div>
                        </div>
                      ))}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
