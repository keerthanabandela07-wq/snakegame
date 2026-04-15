/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Music, 
  Trophy, 
  Gamepad2,
  Sparkles,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const GAME_SPEED = 150;

const TRACKS = [
  { id: 1, name: "Neon Nights", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", mood: "Synthwave" },
  { id: 2, name: "Cyber Chase", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", mood: "Fast-paced" },
  { id: 3, name: "Retro Pulse", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", mood: "Chill" },
];

// --- Gemini Integration ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getBeatDescription(mood: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, cool, retro-arcade style description (max 15 words) for a music track with a ${mood} mood. Use neon and cyberpunk imagery.`,
    });
    return response.text?.trim() || "Pulsing neon rhythms for the ultimate chase.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The digital pulse of the city flows through your veins.";
  }
}

// --- Components ---

export default function App() {
  // Game State
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  
  // Music State
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [beatDescription, setBeatDescription] = useState("Initializing neural beats...");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const currentTrack = TRACKS[currentTrackIndex];

  // --- Game Logic ---
  const generateFood = useCallback(() => {
    const newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    setFood(newFood);
  }, []);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    generateFood();
  };

  const moveSnake = useCallback(() => {
    if (isPaused || isGameOver) return;

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };

      // Check collision with self
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setIsGameOver(true);
        setIsPaused(true);
        if (score > highScore) setHighScore(score);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((s) => s + 10);
        generateFood();
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, isPaused, isGameOver, score, highScore, generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction.y === 0) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y === 0) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x === 0) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x === 0) setDirection({ x: 1, y: 0 }); break;
        case ' ': setIsPaused(p => !p); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  const gameLoop = useCallback((time: number) => {
    if (time - lastUpdateTimeRef.current > GAME_SPEED) {
      moveSnake();
      lastUpdateTimeRef.current = time;
    }
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [moveSnake]);

  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameLoop]);

  // --- Music Logic ---
  useEffect(() => {
    const updateDescription = async () => {
      const desc = await getBeatDescription(currentTrack.mood);
      setBeatDescription(desc);
    };
    updateDescription();
  }, [currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, volume, isMuted, currentTrackIndex]);

  const nextTrack = () => setCurrentTrackIndex((i) => (i + 1) % TRACKS.length);
  const prevTrack = () => setCurrentTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-magenta-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Game Info & Controls */}
        <div className="lg:col-span-4 space-y-6">
          <header className="space-y-2">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-black tracking-tighter italic uppercase"
            >
              Snake <span className="text-cyan-400">&</span> <span className="text-magenta-500">Beats</span>
            </motion.h1>
            <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Retro Arcade Experience v1.0</p>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm relative overflow-hidden group">
              <div className="flex items-center gap-2 text-white/40 mb-1">
                <Trophy size={14} />
                <span className="text-[10px] uppercase font-bold tracking-wider">Score</span>
              </div>
              <div className="text-5xl font-mono font-black text-cyan-400 digital-glow glitch">{score}</div>
              <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm relative overflow-hidden group">
              <div className="flex items-center gap-2 text-white/40 mb-1">
                <Sparkles size={14} />
                <span className="text-[10px] uppercase font-bold tracking-wider">Best</span>
              </div>
              <div className="text-5xl font-mono font-black text-magenta-500 digital-glow glitch">{highScore}</div>
              <div className="absolute inset-0 bg-magenta-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          </div>

          {/* Music Player */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
              <Music size={40} className="text-cyan-400" />
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400/60">Now Playing</span>
              <h3 className="text-xl font-bold truncate">{currentTrack.name}</h3>
              <p className="text-xs text-white/40 font-mono italic">"{beatDescription}"</p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button onClick={prevTrack} className="p-2 hover:text-cyan-400 transition-colors"><ChevronLeft size={20} /></button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 rounded-full bg-cyan-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} className="ml-1" fill="currentColor" />}
                </button>
                <button onClick={nextTrack} className="p-2 hover:text-cyan-400 transition-colors"><ChevronRight size={20} /></button>
              </div>
              
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMuted(!isMuted)} className="text-white/40 hover:text-white transition-colors">
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>

            <audio 
              ref={audioRef} 
              src={currentTrack.url} 
              onEnded={nextTrack}
              loop={false}
            />
          </div>

          <div className="text-[10px] font-mono text-white/20 uppercase leading-relaxed">
            [WASD / ARROWS] TO MOVE<br />
            [SPACE] TO PAUSE / RESUME<br />
            [AI] GENERATING ATMOSPHERE...
          </div>
        </div>

        {/* Right Column: Game Board */}
        <div className="lg:col-span-8 relative">
          <div className="aspect-square bg-black border-4 border-white/5 rounded-3xl overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {/* Grid Background */}
            <div className="absolute inset-0 grid grid-cols-20 grid-rows-20 opacity-5">
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
                <div key={i} className="border-[0.5px] border-white/20" />
              ))}
            </div>

            {/* Game Elements */}
            <div className="absolute inset-0">
              {/* Snake */}
              {snake.map((segment, i) => (
                <motion.div
                  key={`${i}-${segment.x}-${segment.y}`}
                  initial={false}
                  animate={{ 
                    left: `${(segment.x / GRID_SIZE) * 100}%`, 
                    top: `${(segment.y / GRID_SIZE) * 100}%` 
                  }}
                  className={cn(
                    "absolute w-[5%] h-[5%] p-[1px]",
                    i === 0 ? "z-20" : "z-10"
                  )}
                >
                  <div className={cn(
                    "w-full h-full rounded-sm shadow-[0_0_10px_rgba(0,243,255,0.5)]",
                    i === 0 ? "bg-cyan-400" : "bg-cyan-400/40"
                  )} />
                </motion.div>
              ))}

              {/* Food */}
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.8, 1, 0.8]
                }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ 
                  left: `${(food.x / GRID_SIZE) * 100}%`, 
                  top: `${(food.y / GRID_SIZE) * 100}%` 
                }}
                className="absolute w-[5%] h-[5%] p-1 z-30"
              >
                <div className="w-full h-full bg-magenta-500 rounded-full shadow-[0_0_15px_rgba(255,0,255,0.8)]" />
              </motion.div>
            </div>

            {/* Overlays */}
            <AnimatePresence>
              {isPaused && !isGameOver && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-6"
                >
                  <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-full animate-pulse">
                    <Gamepad2 size={48} className="text-cyan-400" />
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">Paused</h2>
                  <button 
                    onClick={() => setIsPaused(false)}
                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-transform"
                  >
                    Resume Game
                  </button>
                </motion.div>
              )}

              {isGameOver && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-8 text-center p-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-6xl font-black italic uppercase tracking-tighter text-magenta-500">Game Over</h2>
                    <p className="text-white/60 font-mono">System Failure. Neural Link Severed.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Final Score</p>
                    <p className="text-5xl font-mono font-bold text-cyan-400">{score}</p>
                  </div>

                  <button 
                    onClick={resetGame}
                    className="group flex items-center gap-3 px-10 py-4 bg-cyan-500 text-black font-black uppercase tracking-tighter rounded-full hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all"
                  >
                    <RotateCcw className="group-hover:rotate-180 transition-transform duration-500" />
                    Restart System
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Decorative Corner Accents */}
          <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-xl" />
          <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-cyan-400 rounded-tr-xl" />
          <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-magenta-500 rounded-bl-xl" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-magenta-500 rounded-br-xl" />
        </div>
      </div>
    </div>
  );
}
