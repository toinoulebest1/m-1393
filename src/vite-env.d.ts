
/// <reference types="vite/client" />

// Types pour react-lrc
declare module 'react-lrc' {
  export interface LyricLine {
    time: number;
    content: string;
  }
  
  export interface ParsedLrc {
    title?: string;
    artist?: string;
    album?: string;
    offset?: number;
    lines: LyricLine[];
  }
  
  export interface LrcProps {
    lrc: string;
    lineRenderer: (params: { index: number; active: boolean; line: LyricLine }) => React.ReactNode;
    currentMillisecond: number;
    onLineChange?: (line: { index: number; line: LyricLine }) => void;
  }
  
  export class Lrc extends React.Component<LrcProps> {}
  
  export function parseLrc(lrc: string): ParsedLrc;
}
