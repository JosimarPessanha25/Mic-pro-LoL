/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer } from 'peerjs';
import { 
  Mic, MicOff, Volume2, VolumeX, LogOut, Users, 
  Link as LinkIcon, ShieldCheck, Gamepad2, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { nanoid } from 'nanoid';

// Types
interface Participant {
  id: string;
  peerId: string;
  nickname: string;
  isMuted: boolean;
  isSpeaking: boolean;
  stream?: MediaStream;
}

// Translations
type Language = 'en' | 'pt';

interface TranslationSet {
  title: string;
  tacticalVoice: string;
  roomLabel: string;
  statusLabel: string;
  statusActive: string;
  inviteBtn: string;
  copiedBtn: string;
  headerSubtitle: string;
  nickLabel: string;
  nickPlaceholder: string;
  joinBtn: string;
  errorNick: string;
  errorMic: string;
  errorFull: string;
  muteLabel: string;
  unmuteLabel: string;
  deafenLabel: string;
  undeafenLabel: string;
  leaveBtn: string;
  waitingLabel: string;
  speakingLabel: string;
  mutedLabel: string;
  connectedLabel: string;
  youLabel: string;
  leaderLabel: string;
  noAudioLabel: string;
  kickLabel: string;
  remoteMuteLabel: string;
  protocolLabel: string;
  epicOffers: string;
  featured: string;
  adPartnership: string;
  contactBtn: string;
  hardwareSetup: string;
  hardwareSubtitle: string;
  newWorlds: string;
  newWorldsSubtitle: string;
}

const TRANSLATIONS: Record<Language, TranslationSet> = {
  en: {
    title: 'MIC for LoL',
    tacticalVoice: 'Tactical Voice',
    roomLabel: 'ROOM',
    statusLabel: 'Connection',
    statusActive: 'Stable',
    inviteBtn: 'Invite',
    copiedBtn: 'Copied!',
    headerSubtitle: 'League of Legends',
    nickLabel: 'Summoner Nickname',
    nickPlaceholder: 'EX: T1 FAKER',
    joinBtn: 'Start Connection',
    errorNick: 'Enter a nickname first!',
    errorMic: 'Could not access microphone.',
    errorFull: 'This room is full (5 members max)!',
    muteLabel: 'Mute',
    unmuteLabel: 'Unmute',
    deafenLabel: 'Deafen',
    undeafenLabel: 'Undeafen',
    leaveBtn: 'Leave Call',
    waitingLabel: 'Waiting...',
    speakingLabel: 'Speaking',
    mutedLabel: 'Muted',
    connectedLabel: 'Connected',
    youLabel: '(You)',
    leaderLabel: 'Room Leader',
    noAudioLabel: 'No Audio',
    kickLabel: 'Kick',
    remoteMuteLabel: 'Mute User',
    protocolLabel: 'Protocol',
    epicOffers: 'Epic Offers',
    featured: 'Featured',
    adPartnership: 'Want to partner to promote your brand?',
    contactBtn: 'Contact us',
    hardwareSetup: 'Setup Upgrade',
    hardwareSubtitle: 'Best peripherals for your rank.',
    newWorlds: 'New Worlds',
    newWorldsSubtitle: 'Check this week\'s releases.',
  },
  pt: {
    title: 'Mic pro LoL',
    tacticalVoice: 'Voz Tática',
    roomLabel: 'SALA',
    statusLabel: 'Sinal',
    statusActive: 'Estável',
    inviteBtn: 'Convidar',
    copiedBtn: 'Copiado!',
    headerSubtitle: 'League of Legends',
    nickLabel: 'Nickname do Invocador',
    nickPlaceholder: 'EX: T1 FAKER',
    joinBtn: 'Iniciar Conexão',
    errorNick: 'Digite um nickname primeiro!',
    errorMic: 'Não foi possível acessar o microfone.',
    errorFull: 'Esta sala já possui 5 membros!',
    muteLabel: 'Mutar',
    unmuteLabel: 'Desmutar',
    deafenLabel: 'Surdo',
    undeafenLabel: 'Ativar Áudio',
    leaveBtn: 'Sair da Call',
    waitingLabel: 'Aguardando...',
    speakingLabel: 'Falando',
    mutedLabel: 'No Mudo',
    connectedLabel: 'Conectado',
    youLabel: '(Você)',
    leaderLabel: 'Líder da Sala',
    noAudioLabel: 'Sem Áudio',
    kickLabel: 'Remover',
    remoteMuteLabel: 'Mutar Usuário',
    protocolLabel: 'Protocolo',
    epicOffers: 'Ofertas Épicas',
    featured: 'Em Destaque',
    adPartnership: 'Deseja anunciar sua marca ou produto aqui?',
    contactBtn: 'Entre em contato',
    hardwareSetup: 'Upgrade no Setup',
    hardwareSubtitle: 'Os melhores periféricos para o seu elo.',
    newWorlds: 'Novos Mundos',
    newWorldsSubtitle: 'Confira os lançamentos da semana.',
  }
};

export default function App() {
  const [language, setLanguage] = useState<Language>('pt');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [micGain, setMicGain] = useState(0.5);
  const [outputVolume, setOutputVolume] = useState(0.8);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [myIsSpeaking, setMyIsSpeaking] = useState(false);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const nicknamesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Handle URL parameters for joining
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, []);

  useEffect(() => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.setTargetAtTime(micGain, audioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [micGain]);

  const initAudioAnalysis = async (stream: MediaStream, userId: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Ensure context is running (browsers often pause it)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analysersRef.current.set(userId, analyser);

    const checkSpeaking = () => {
      const currentAnalyser = analysersRef.current.get(userId);
      if (!currentAnalyser) return;

      const dataArray = new Uint8Array(currentAnalyser.frequencyBinCount);
      currentAnalyser.getByteFrequencyData(dataArray);
      
      // Calculate volume more accurately
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const isTalking = average > 10; // More sensitive threshold (was 15)

      if (userId === 'me') {
        setMyIsSpeaking(isTalking);
      } else {
        setParticipants(prev => prev.map(p => {
          if (p.id === userId) {
            return { ...p, isSpeaking: isTalking };
          }
          return p;
        }));
      }

      // Keep looping while the analyser exists
      if (analysersRef.current.has(userId)) {
        requestAnimationFrame(checkSpeaking);
      }
    };
    checkSpeaking();
  };

  const joinRoom = async () => {
    if (!nickname.trim()) {
      setError(t.errorNick);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        } 
      });

      // Setup Mic Gain Control
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const gainNode = audioContextRef.current.createGain();
      const destination = audioContextRef.current.createMediaStreamDestination();
      
      gainNode.gain.value = micGain;
      source.connect(gainNode);
      gainNode.connect(destination);
      micGainNodeRef.current = gainNode;

      const processedStream = destination.stream;
      setMyStream(processedStream);
      initAudioAnalysis(processedStream, 'me');

      const targetRoom = roomId || nanoid(10);
      setRoomId(targetRoom);
      
      // PeerJS with default cloud server (reliable enough for demo)
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (peerId) => {
        socketRef.current = io();
        socketRef.current.emit('join-room', targetRoom, peerId, nickname);
        setIsJoined(true);
        window.history.pushState({}, '', `?room=${targetRoom}`);

        // Notify that I joined so others can call me
        socketRef.current.on('user-joined-room', (remotePeerId: string, remoteNickname: string, currentLeaderId: string) => {
          console.log("Remote peer joined:", remoteNickname);
          nicknamesRef.current.set(remotePeerId, remoteNickname);
          setLeaderId(currentLeaderId);
          
          if (peerId !== remotePeerId) {
            console.log("Calling peer:", remotePeerId);
            const call = peer.call(remotePeerId, processedStream, { metadata: { nickname } });
            handleCall(call);
          }
        });

        socketRef.current.on('leader-update', (newLeaderId: string) => {
          setLeaderId(newLeaderId);
        });

        socketRef.current.on('you-are-kicked', () => {
          leaveRoom();
          setError("Você foi removido da sala pelo líder.");
        });

        socketRef.current.on('you-are-muted-by-leader', () => {
          // Force mute
          if (processedStream) {
            const audioTrack = processedStream.getAudioTracks()[0];
            audioTrack.enabled = false;
            setIsMuted(true);
          }
        });

        socketRef.current.on('adjust-your-mic-gain', (newGain: number) => {
          setMicGain(newGain);
        });

        socketRef.current.on('room-full', () => {
          setError(t.errorFull);
          leaveRoom();
        });

        socketRef.current.on('user-left', (remotePeerId: string) => {
          setParticipants(prev => prev.filter(p => p.id !== remotePeerId));
        });

        // Handle incoming calls
        peer.on('call', (call) => {
          call.answer(processedStream);
          handleCall(call);
        });
      });
    } catch (err) {
      setError(t.errorMic);
    }
  };

  const handleCall = (call: any) => {
    call.on('stream', (remoteStream: MediaStream) => {
      const remoteId = call.peer;
      const remoteNickname = call.metadata?.nickname || nicknamesRef.current.get(remoteId) || "Invocador";
      
      setParticipants(prev => {
        if (prev.find(p => p.id === remoteId)) return prev;
        const newParticipant: Participant = {
          id: remoteId,
          peerId: remoteId,
          nickname: remoteNickname,
          isMuted: false,
          isSpeaking: false,
          stream: remoteStream
        };
        initAudioAnalysis(remoteStream, remoteId);
        return [...prev, newParticipant];
      });
    });
  };

  // Re-implementing with more robust WebRTC signaling if needed, 
  // but let's stick to a solid UI first.
  
  const leaveRoom = () => {
    socketRef.current?.disconnect();
    peerRef.current?.destroy();
    myStream?.getTracks().forEach(track => track.stop());
    setIsJoined(false);
    setParticipants([]);
    setMyStream(null);
    setError(null);
    window.history.pushState({}, '', '/');
  };

  const toggleMute = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  const t = TRANSLATIONS[language];

  if (!isJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-lo-dark overflow-hidden relative">
        {/* Language Selector (Landing) */}
        <div className="absolute top-8 right-8 z-20 flex gap-2">
          {(['en', 'pt'] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`text-[10px] font-bold px-3 py-1 border transition-all ${
                language === l 
                  ? 'border-lo-gold text-lo-gold bg-lo-gold/10' 
                  : 'border-lo-gold/20 text-lo-muted hover:border-lo-gold/50'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Animated background particles or subtle glow */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-lo-blue/5 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-lo-gold/5 rounded-full blur-[100px]"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-gradient-to-br from-lo-bg to-lo-dark border border-lo-gold/40 p-10 shadow-2xl relative z-10"
        >
          {/* Hextech corners */}
          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-lo-gold"></div>
          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-lo-gold"></div>
          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-lo-gold"></div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-lo-gold"></div>

          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 border-2 border-lo-gold flex items-center justify-center rotate-45 mb-8 shadow-[0_0_20px_rgba(200,170,110,0.2)]">
              <div className="-rotate-45 text-lo-gold">
                <Mic size={40} />
              </div>
            </div>
            <h1 className="text-3xl font-black text-lo-text tracking-widest uppercase mb-1">{t.title}</h1>
            <div className="flex items-center gap-2">
              <div className="h-[1px] w-8 bg-lo-gold/30"></div>
              <p className="text-lo-gold text-[10px] uppercase font-bold tracking-[0.3em]">{t.tacticalVoice}</p>
              <div className="h-[1px] w-8 bg-lo-gold/30"></div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <label className="block text-[10px] font-bold text-lo-muted uppercase tracking-widest mb-3">
                {t.nickLabel}
              </label>
              <input 
                type="text"
                placeholder={t.nickPlaceholder}
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toUpperCase())}
                className="w-full bg-lo-dark border border-lo-gold/20 focus:border-lo-blue outline-none p-4 text-lo-text transition-all font-mono tracking-widest placeholder:text-lo-muted/30"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center border border-red-500/20 bg-red-500/5 py-2 px-4"
              >
                {error}
              </motion.div>
            )}

            <button 
              onClick={joinRoom}
              className="w-full py-5 bg-lo-gold/10 hover:bg-lo-gold text-lo-gold hover:text-lo-dark font-black uppercase tracking-[0.2em] transition-all border border-lo-gold shadow-[0_0_25px_rgba(200,170,110,0.1)] hover:shadow-[0_0_35px_rgba(200,170,110,0.3)] cursor-pointer text-sm"
            >
              {t.joinBtn}
            </button>

            <div className="flex items-center justify-center gap-3 pt-6 border-t border-lo-gold/10">
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-lo-blue animate-pulse"></div>
                <div className="w-1 h-1 rounded-full bg-lo-blue animate-pulse delay-75"></div>
                <div className="w-1 h-1 rounded-full bg-lo-blue animate-pulse delay-150"></div>
              </div>
              <p className="text-[9px] text-lo-muted/50 uppercase tracking-widest font-bold">
                Low Latency WebRTC P2P
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleInvite = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden border-2 md:border-8 border-lo-border">
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center justify-between px-3 md:px-8 border-b border-lo-gold/30 bg-gradient-to-b from-lo-bg to-lo-dark shadow-lg">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 border-2 border-lo-gold flex items-center justify-center rotate-45 bg-lo-dark">
            <div className="-rotate-45 font-bold text-[8px] md:text-[10px] text-lo-gold">MIC</div>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-lo-muted font-semibold leading-none">{t.tacticalVoice}</span>
            <span className="text-xs md:text-lg font-bold tracking-tight text-lo-text uppercase leading-tight">{t.headerSubtitle}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
           <div className="bg-lo-border px-6 py-2 border border-lo-gold/50 rounded-sm flex items-center gap-2">
            <span className="text-lo-muted text-xs uppercase">{t.roomLabel}:</span>
            <span className="text-lo-gold font-mono font-bold tracking-widest text-sm">{roomId}</span>
          </div>
          
          <div className="flex gap-1">
            {(['en', 'pt'] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`text-[8px] font-bold px-2 py-1 border transition-all ${
                  language === l 
                    ? 'border-lo-gold text-lo-gold bg-lo-gold/10' 
                    : 'border-lo-gold/20 text-lo-muted hover:border-lo-gold/50'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <div className="hidden xs:flex flex-col items-end">
            <span className="text-[8px] md:text-[10px] text-lo-blue uppercase">{t.statusLabel}</span>
            <span className="text-[10px] md:text-xs font-mono">{t.statusActive}</span>
          </div>
          <div className="hidden xs:block w-[1px] h-8 bg-lo-gold/20"></div>
          <button 
            onClick={handleInvite}
            className="btn-hextech min-w-[80px] md:min-w-[100px] text-[10px] md:text-sm px-2 md:px-4"
          >
            {copied ? t.copiedBtn : t.inviteBtn}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Ad Sidebar (Desktop Only) */}
        <aside className="hidden xl:flex w-64 border-r border-lo-gold/20 flex-col p-6 gap-6 bg-lo-bg/30">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 size={14} className="text-lo-gold" />
            <span className="text-[10px] font-bold text-lo-gold tracking-[0.2em] uppercase">{t.epicOffers}</span>
          </div>
          
          <div className="ad-placeholder flex-1 group transition-all">
             <div className="flex flex-col items-center gap-6 text-lo-muted/20">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-widest mb-1">Slot #01</p>
                </div>
                <div className="w-full h-[1px] bg-lo-gold/5"></div>
             </div>
          </div>
          
          <div className="text-[8px] text-center text-lo-muted/40 uppercase tracking-widest">
            Ad Space Available
          </div>
        </aside>

        {/* Main Grid */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 flex flex-col items-center justify-start md:justify-center bg-lo-dark">
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-12 w-full max-w-6xl">
            {/* Me */}
            <ParticipantCard 
              id={peerRef.current?.id || 'me'}
              nickname={nickname} 
              isMe 
              isMuted={isMuted} 
              isSpeaking={myIsSpeaking} 
              leaderId={leaderId}
              myPeerId={peerRef.current?.id || ''}
              socket={socketRef.current}
              roomId={roomId || ''}
              outputVolume={outputVolume}
              t={t}
            />

            {/* Others */}
            <AnimatePresence>
              {participants.map((p) => (
                <ParticipantCard 
                  key={p.id}
                  id={p.id}
                  nickname={p.nickname}
                  isMuted={p.isMuted}
                  isSpeaking={p.isSpeaking}
                  stream={p.stream}
                  isDeafened={isDeafened}
                  leaderId={leaderId}
                  myPeerId={peerRef.current?.id || ''}
                  socket={socketRef.current}
                  roomId={roomId || ''}
                  outputVolume={outputVolume}
                  t={t}
                />
              ))}
            </AnimatePresence>

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, 5 - (participants.length + 1)) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center gap-4 opacity-10 md:opacity-30 grayscale hover:grayscale-0 transition-all scale-75 md:scale-100 py-4">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-dashed border-lo-gold/30 flex items-center justify-center bg-lo-dark">
                   <span className="text-lo-gold text-2xl md:text-4xl font-light hover:scale-110 transition-transform">+</span>
                </div>
                <div className="text-center">
                  <h3 className="text-lo-muted text-[10px] md:text-sm uppercase tracking-widest italic font-medium">{t.waitingLabel}</h3>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Right Ad Sidebar (Desktop Only) */}
        <aside className="hidden xl:flex w-64 border-l border-lo-gold/20 flex-col p-6 gap-6 bg-lo-bg/30">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-lo-gold" />
            <span className="text-[10px] font-bold text-lo-gold tracking-[0.2em] uppercase">{t.featured}</span>
          </div>
          
          <div className="ad-placeholder flex-1 overflow-hidden">
             <div className="flex flex-col items-center gap-6 text-lo-muted w-full">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-widest mb-1 opacity-20">Slot #02</p>
                </div>
                
                <div className="w-full h-[1px] bg-lo-gold/10"></div>
                
                <div className="p-4 bg-lo-gold/5 border border-lo-gold/10 rounded w-full">
                   <p className="text-[9px] text-lo-gold/80 leading-relaxed text-center">
                     {t.adPartnership}
                   </p>
                   <a 
                     href={`mailto:pessanhasimar9@gmail.com?subject=Parceria de Publicidade - ${t.title}`}
                     className="w-full mt-3 py-2 border border-lo-gold/30 text-[8px] uppercase tracking-tighter hover:bg-lo-gold/20 transition-all flex items-center justify-center font-bold text-lo-gold shadow-[0_0_10px_rgba(200,155,60,0.05)]"
                   >
                     {t.contactBtn}
                   </a>
                </div>

                <div className="text-[8px] opacity-10 text-center px-4 uppercase tracking-tighter">
                   Conteúdo Reservado
                </div>
             </div>
          </div>
          
          <div className="text-[8px] text-center text-lo-muted/40 uppercase tracking-widest pt-2">
            P2P Direct v0.9
          </div>
        </aside>
      </div>

      {/* Footer Controls */}
      <footer className="h-24 md:h-28 bg-lo-bg border-t border-lo-gold/30 shrink-0 flex items-center justify-between px-2 md:px-12">
        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:gap-8 flex-1 justify-around md:justify-center md:flex-none w-full">
          <div className="flex items-center gap-1 md:gap-2">
            <button 
              onClick={toggleMute}
              className="group flex flex-col items-center gap-1 md:gap-2 cursor-pointer"
            >
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full border ${isMuted ? 'border-red-500 bg-red-900/20 text-red-500' : 'border-lo-gold/50 text-lo-text bg-lo-dark hover:border-lo-blue hover:text-lo-blue'} flex items-center justify-center transition-all shadow-lg`}>
                {isMuted ? <MicOff size={18} className="md:w-6 md:h-6" /> : <Mic size={18} className="md:w-6 md:h-6" />}
              </div>
              <span className="text-[7px] md:text-[10px] uppercase tracking-tighter font-bold">{isMuted ? t.unmuteLabel : t.muteLabel}</span>
            </button>
            <div className="hidden xl:flex flex-col gap-1 w-20">
               <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={micGain} 
                onChange={(e) => setMicGain(parseFloat(e.target.value))}
                className="w-full accent-lo-blue h-1 bg-lo-gold/20 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[7px] text-lo-blue uppercase font-bold text-center">Ganho: {Math.round(micGain * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <button 
              onClick={toggleDeafen}
              className="group flex flex-col items-center gap-1 md:gap-2 cursor-pointer"
            >
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full border ${isDeafened ? 'border-red-500 bg-red-900/20 text-red-500' : 'border-lo-gold/50 text-lo-text bg-lo-dark hover:border-lo-blue hover:text-lo-blue'} flex items-center justify-center transition-all shadow-lg`}>
                {isDeafened ? <VolumeX size={18} className="md:w-6 md:h-6" /> : <Volume2 size={18} className="md:w-6 md:h-6" />}
              </div>
              <span className="text-[7px] md:text-[10px] uppercase tracking-tighter font-bold">{isDeafened ? t.undeafenLabel : t.deafenLabel}</span>
            </button>
            <div className="hidden xl:flex flex-col gap-1 w-20">
               <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={outputVolume} 
                onChange={(e) => setOutputVolume(parseFloat(e.target.value))}
                className="w-full accent-lo-gold h-1 bg-lo-gold/20 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[7px] text-lo-gold uppercase font-bold text-center">Volume: {Math.round(outputVolume * 100)}%</span>
            </div>
          </div>

          <div className="mx-1 md:mx-4 h-8 md:h-12 w-[1px] bg-lo-gold/20"></div>

          <button 
            onClick={leaveRoom}
            className="btn-danger text-[10px] md:text-sm py-2 px-3 md:py-3 md:px-6"
          >
            {t.leaveBtn}
          </button>
        </div>

        {/* Secondary Meta */}
        <div className="hidden lg:flex flex-col items-end opacity-60 text-right">
        </div>
      </footer>
    </div>
  );
}

interface ParticipantCardProps {
  id: string;
  nickname: string;
  isMe?: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  stream?: MediaStream;
  isDeafened?: boolean;
  leaderId: string | null;
  myPeerId: string;
  socket: Socket | null;
  roomId: string;
  outputVolume: number;
  t: TranslationSet;
  key?: any;
}

function ParticipantCard({ 
  id,
  nickname, 
  isMe = false, 
  isMuted, 
  isSpeaking, 
  stream,
  isDeafened = false,
  leaderId,
  myPeerId,
  socket,
  roomId,
  outputVolume,
  t
}: ParticipantCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume * outputVolume;
    }
  }, [volume, outputVolume]);

  const isIamLeader = myPeerId === leaderId;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center gap-4 group relative"
    >
      <div className="relative w-24 h-24 md:w-32 md:h-32">
        {/* Enhanced Speaking Pulse Ring */}
        <AnimatePresence>
          {isSpeaking && !isMuted && (
            <div className="absolute inset-0 pointer-events-none">
              <motion.div 
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 1.8, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border-4 border-lo-blue/60 z-0"
              />
              <motion.div 
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut", delay: 0.4 }}
                className="absolute inset-0 rounded-full border-2 border-lo-gold/40 z-0"
              />
            </div>
          )}
        </AnimatePresence>

        <div className={`w-full h-full rounded-full border-4 transition-all duration-300 flex items-center justify-center bg-lo-dark overflow-hidden relative z-10 ${
          isSpeaking && !isMuted
            ? 'border-lo-blue shadow-[0_0_40px_rgba(10,200,185,0.7)] scale-105' 
            : isMuted 
              ? 'border-red-900/50' 
              : 'border-lo-gold/20'
        }`}>
          <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-lo-border to-lo-bg rounded-full flex items-center justify-center border border-lo-gold/30">
            <span className={`text-xl md:text-3xl font-bold uppercase transition-colors ${isSpeaking && !isMuted ? 'text-lo-blue' : isMuted ? 'text-red-500' : 'text-lo-gold'}`}>
              {nickname.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
        
        {isSpeaking && !isMuted && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-lo-blue text-lo-dark text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter z-20">
            {t.speakingLabel}
          </div>
        )}
        {isMuted && !isSpeaking && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">
            {t.mutedLabel}
          </div>
        )}

        {/* Moderation Controls (Leader only, on others) */}
        {isIamLeader && !isMe && (
          <div className="absolute -top-2 -right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
             <button 
              onClick={() => socket?.emit('kick-user', roomId, id)}
              title={t.kickLabel}
              className="w-8 h-8 rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center shadow-lg border border-red-400/50 cursor-pointer"
             >
               <LogOut size={14} className="rotate-180" />
             </button>
             <button 
              onClick={() => socket?.emit('mute-user', roomId, id)}
              title={t.remoteMuteLabel}
              className="w-8 h-8 rounded-full bg-lo-dark/80 hover:bg-lo-gold text-lo-gold hover:text-lo-dark flex items-center justify-center shadow-lg border border-lo-gold/50 cursor-pointer"
             >
               <MicOff size={14} />
             </button>
          </div>
        )}
      </div>
      
      <div className="text-center">
        <h3 className={`font-bold uppercase tracking-[0.1em] md:tracking-widest text-[10px] md:text-sm transition-colors ${isMe ? 'text-lo-text' : 'text-lo-muted'}`}>
          {nickname} {isMe && <span className="text-[8px] md:text-[10px] text-lo-blue">{t.youLabel}</span>}
        </h3>
        <p className="text-lo-muted/60 text-[8px] md:text-[10px] uppercase tracking-tighter font-bold flex items-center justify-center gap-1">
          {(myPeerId === id || id === leaderId) && <ShieldCheck size={10} className="text-lo-gold" />}
          {id === leaderId ? t.leaderLabel : isMuted ? t.noAudioLabel : t.connectedLabel}
        </p>
      </div>

      {!isMe && stream && (
        <div className="w-full max-w-[120px] md:max-w-[140px] px-1 md:px-2 flex flex-col gap-1 items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-auto">
          <div className="flex items-center gap-2 w-full">
            <Volume2 size={12} className={volume === 0 ? 'text-red-500' : 'text-lo-gold'} />
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-lo-gold h-1 flex-1 bg-lo-gold/20 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[9px] font-mono w-6 text-lo-muted/60">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Leader Remote Mic Gain Control */}
          {isIamLeader && (
            <div className="flex items-center gap-2 w-full mt-2 border-t border-lo-blue/20 pt-2">
              <Mic size={10} className="text-lo-blue" />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                className="w-full accent-lo-blue h-0.5 flex-1 bg-lo-blue/10 rounded-lg appearance-none cursor-pointer"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  socket?.emit('leader-adjust-mic-gain', roomId, id, val);
                }}
              />
              <span className="text-[7px] font-bold text-lo-blue uppercase">Mic</span>
            </div>
          )}
        </div>
      )}

      {!isMe && stream && (
        <audio ref={audioRef} autoPlay muted={isDeafened} />
      )}
    </motion.div>
  );
}
