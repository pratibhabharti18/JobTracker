import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Play, Square, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const InterviewCoach: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [context, setContext] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  const playNextChunk = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) return;
    
    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;
    
    const buffer = audioContextRef.current.createBuffer(1, audioData.length, 24000);
    buffer.getChannelData(0).set(audioData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };
    source.start();
  };

  const startSession = async () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        alert('Gemini API Key is missing');
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const ctx = initAudioContext();

      // Start microphone first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [{ text: `You are a professional hiring manager conducting a job interview. 
            Context provided by candidate: "${context}". 
            Start by introducing yourself and asking a relevant question. 
            Keep your responses concise and conversational.` }]
          },
        },
        callbacks: {
          onopen: () => {
            addLog('Session connected');
            setIsConnected(true);
            setIsRecording(true);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Downsample/Convert to PCM16
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              
              // Convert to base64
              let binary = '';
              const bytes = new Uint8Array(pcm16.buffer);
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64String = btoa(binary);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput([{
                  mimeType: "audio/pcm;rate=24000",
                  data: base64String
                }]);
              });
            };
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 0x7FFF;
              }
              
              audioQueueRef.current.push(float32);
              playNextChunk();
            }
            
            if (message.serverContent?.turnComplete) {
              addLog('AI finished speaking');
            }
          },
          onclose: () => {
            addLog('Session closed');
            setIsConnected(false);
            setIsRecording(false);
          },
          onerror: (err) => {
            addLog(`Error: ${err}`);
          }
        }
      });

      sessionRef.current = sessionPromise;
      
      source.connect(processor);
      processor.connect(ctx.destination);

    } catch (error) {
      console.error('Failed to start session', error);
      addLog(`Error: ${error}`);
    }
  };

  const stopSession = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (sessionRef.current) {
      sessionRef.current.then((s: any) => s.close());
    }
    setIsConnected(false);
    setIsRecording(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">AI Interview Coach</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Practice your interview skills with our AI coach. Provide some context about the job or your resume, and start the conversation.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Interview Context (Job Description / Resume Summary)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            className="w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3 border"
            placeholder="I am applying for a Senior React Developer role at a tech startup. I have 5 years of experience..."
            disabled={isConnected}
          />
        </div>

        <div className="flex justify-center">
          {!isConnected ? (
            <button
              onClick={startSession}
              disabled={!context.trim()}
              className={clsx(
                "flex items-center px-6 py-3 rounded-full text-white font-medium transition-all",
                context.trim() 
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5" 
                  : "bg-gray-400 cursor-not-allowed"
              )}
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Interview Session
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="flex items-center px-6 py-3 rounded-full text-white font-medium bg-red-600 hover:bg-red-700 shadow-lg transition-all animate-pulse"
            >
              <Square className="w-5 h-5 mr-2" />
              End Session
            </button>
          )}
        </div>

        {isConnected && (
          <div className="flex items-center justify-center space-x-2 text-indigo-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Live Session Active</span>
          </div>
        )}
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-64 overflow-y-auto font-mono text-xs text-gray-600">
        <div className="font-bold mb-2 text-gray-500">Session Logs:</div>
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
        {logs.length === 0 && <div className="text-gray-400 italic">Logs will appear here...</div>}
      </div>
    </div>
  );
};

export default InterviewCoach;
