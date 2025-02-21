
interface Window {
  SpeechRecognition: new () => SpeechRecognition;
  webkitSpeechRecognition: new () => SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent {
  results: {
    item(index: number): { item(index: number): { transcript: string } };
    [index: number]: { [index: number]: { transcript: string } };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}
