import React, { useState, useEffect, Component, ReactNode } from 'react';
import { 
  Play, 
  Info, 
  Plus, 
  Search, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Settings, 
  ChevronRight, 
  ChevronLeft,
  X,
  CreditCard,
  Check,
  ShieldCheck,
  Film,
  MessageSquare,
  Sparkles,
  RotateCw,
  Heart,
  ThumbsUp,
  Smile,
  Frown,
  Ghost,
  Flame,
  Zap,
  Clock,
  CloudRain,
  Sun,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getMovieRecommendation } from './services/geminiService';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  getDoc,
  Timestamp,
  getDocFromServer,
  FirestoreError
} from 'firebase/firestore';
import { auth, db } from './firebase';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't always want to crash the app, but we must log it as required.
  return errInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    const { hasError, error } = this.state as any;
    if (hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              {error?.message?.startsWith('{') 
                ? "A database permission error occurred. Please make sure you are signed in."
                : "An unexpected error occurred."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-2 rounded font-bold hover:bg-red-700"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return (this.props as any).children;
  }
}

// --- Types ---

interface Movie {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  genre: string;
  releaseYear: number;
  reactions?: Record<string, number>;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  subscriptionStatus: 'active' | 'inactive';
  subscriptionType: 'monthly' | 'yearly' | 'none';
  subscriptionExpiry: any;
}

// --- Components ---

const Navbar = ({ user, profile, onSignOut, onOpenAdmin, onOpenDiscovery, onOpenChat }: { 
  user: FirebaseUser | null, 
  profile: UserProfile | null,
  onSignOut: () => void,
  onOpenAdmin: () => void,
  onOpenDiscovery: () => void,
  onOpenChat: () => void
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-colors duration-300 px-4 md:px-12 py-4 flex items-center justify-between ${isScrolled ? 'bg-black' : 'bg-gradient-to-b from-black/80 to-transparent'}`}>
      <div className="flex items-center gap-8">
        <h1 className="text-red-600 text-2xl md:text-3xl font-bold tracking-tighter uppercase">Tefiles</h1>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
          <a href="#" className="hover:text-white transition-colors">Home</a>
          <button onClick={onOpenDiscovery} className="hover:text-white transition-colors flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-red-600" /> Discovery
          </button>
          <a href="#" className="hover:text-white transition-colors">Movies</a>
          <a href="#" className="hover:text-white transition-colors">My List</a>
        </div>
      </div>

      <div className="flex items-center gap-4 text-white">
        <button onClick={onOpenChat} className="hover:text-red-600 transition-colors">
          <MessageSquare className="w-5 h-5" />
        </button>
        <Search className="w-5 h-5 cursor-pointer hover:text-gray-300" />
        <Bell className="w-5 h-5 cursor-pointer hover:text-gray-300" />
        {user ? (
          <div className="group relative">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <UserIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="absolute right-0 top-full mt-2 w-48 bg-black/95 border border-white/10 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all py-2">
              <div className="px-4 py-2 border-bottom border-white/10 text-xs text-gray-400 truncate">
                {user.email}
              </div>
              {profile?.role === 'admin' && (
                <>
                  <div className="px-4 py-1 mb-1">
                    <span className="bg-red-600/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-600/30 uppercase tracking-widest">
                      Designer
                    </span>
                  </div>
                  <button 
                    onClick={onOpenAdmin}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 flex items-center gap-2 text-white"
                  >
                    <Settings className="w-4 h-4" /> Admin Panel
                  </button>
                </>
              )}
              <button 
                onClick={onSignOut}
                className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="bg-red-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
};

const MovieRow = ({ title, movies, onMovieClick, onReact }: { title: string, movies: Movie[], onMovieClick: (m: Movie) => void, onReact: (m: Movie, emoji: string) => void }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="mb-8 px-4 md:px-12 group">
      <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
      <div className="relative">
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-10 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-2"
        >
          <ChevronLeft className="text-white w-8 h-8" />
        </button>
        
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-hidden scroll-smooth"
        >
          {movies.map((movie) => (
            <div key={movie.id} className="group/item relative flex-none w-40 md:w-64">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                onClick={() => onMovieClick(movie)}
                className="aspect-video bg-zinc-900 rounded cursor-pointer relative overflow-hidden"
              >
                <img 
                  src={movie.thumbnail} 
                  alt={movie.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 hover:bg-black/0 transition-colors" />
              </motion.div>
              
              {/* Emoji Reactions */}
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                {['😱', '😂', '😢', '🔥', '❤️'].map(emoji => (
                  <button 
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact(movie, emoji);
                    }}
                    className="bg-black/60 hover:bg-red-600 p-1 rounded text-xs transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-10 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-2"
        >
          <ChevronRight className="text-white w-8 h-8" />
        </button>
      </div>
    </div>
  );
};

const AIChatAssistant = ({ movies, onClose }: { movies: Movie[], onClose: () => void }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Hi! I am Tefiles AI. Looking for a movie recommendation or want to know more about a film?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    const aiResponse = await getMovieRecommendation(userMsg, movies);
    setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 right-4 w-80 md:w-96 h-[500px] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden fixed-bottom-safe"
    >
      <div className="p-4 border-b border-white/10 bg-red-600 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold">
          <Sparkles className="w-5 h-5" /> Tefiles AI Assistant
        </div>
        <button onClick={onClose} className="hover:bg-black/20 p-1 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-red-600 text-white rounded-tr-none' : 'bg-zinc-800 text-gray-200 rounded-tl-none'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-grow bg-zinc-800 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-red-600"
          />
          <button 
            onClick={handleSend}
            className="bg-red-600 p-2 rounded-full hover:bg-red-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const DiscoveryMode = ({ movies, onPlay, onClose }: { movies: Movie[], onPlay: (m: Movie) => void, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [mood, setMood] = useState<string | null>(null);

  const moods = [
    { label: 'Mind-Bending', icon: <Zap className="w-4 h-4" />, genre: 'Sci-Fi' },
    { label: 'Emotional', icon: <CloudRain className="w-4 h-4" />, genre: 'Drama' },
    { label: 'Action Packed', icon: <Flame className="w-4 h-4" />, genre: 'Action' },
    { label: 'Chill', icon: <Sun className="w-4 h-4" />, genre: 'Comedy' },
    { label: 'Spooky', icon: <Ghost className="w-4 h-4" />, genre: 'Horror' },
  ];

  const filteredMovies = mood ? movies.filter(m => m.genre?.toLowerCase().includes(mood.toLowerCase())) : movies;
  const currentMovie = filteredMovies[currentIndex % filteredMovies.length];

  const handleSpin = () => {
    setIsSpinning(true);
    setTimeout(() => {
      setIsSpinning(false);
      const randomMood = moods[Math.floor(Math.random() * moods.length)];
      setMood(randomMood.genre);
      setCurrentIndex(Math.floor(Math.random() * movies.length));
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-black" />
      <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white z-10">
        <X className="w-8 h-8" />
      </button>

      <div className="relative w-full max-w-md flex flex-col items-center gap-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">Discovery Mode</h2>
          <p className="text-gray-400">Swipe or spin to find your next favorite film</p>
        </div>

        {/* Mood Picker */}
        <div className="flex flex-wrap justify-center gap-2">
          {moods.map(m => (
            <button 
              key={m.label}
              onClick={() => setMood(m.genre)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${mood === m.genre ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Tinder Card */}
        <AnimatePresence mode="wait">
          {currentMovie && (
            <motion.div 
              key={currentMovie.id}
              initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ x: 300, opacity: 0, rotate: 20 }}
              className="relative w-full aspect-[3/4] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              <img 
                src={currentMovie.thumbnail} 
                alt={currentMovie.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="text-2xl font-bold mb-2">{currentMovie.title}</h3>
                <p className="text-sm text-gray-300 line-clamp-2 mb-6">{currentMovie.description}</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => onPlay(currentMovie)}
                    className="flex-grow bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
                  >
                    Watch Now
                  </button>
                  <button 
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="bg-white/10 p-3 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spin Button */}
        <button 
          onClick={handleSpin}
          disabled={isSpinning}
          className={`flex items-center gap-2 bg-white text-black px-8 py-3 rounded-full font-bold shadow-xl hover:scale-105 transition-all ${isSpinning ? 'animate-pulse' : ''}`}
        >
          <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} /> 
          {isSpinning ? 'Spinning...' : 'Mood Picker Wheel'}
        </button>
      </div>
    </div>
  );
};

const SubscriptionModal = ({ onClose, onSubscribe }: { onClose: () => void, onSubscribe: (type: 'monthly' | 'yearly') => void }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-zinc-900 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      >
        <div className="p-8 md:p-12">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Choose your plan</h2>
              <p className="text-gray-400">Watch everything on Tefiles. Change or cancel anytime.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Monthly Plan */}
            <div className="bg-zinc-800/50 p-6 rounded-xl border border-white/5 hover:border-red-600 transition-colors flex flex-col">
              <div className="mb-4">
                <span className="text-red-600 font-bold uppercase text-xs tracking-wider">Monthly</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">25</span>
                  <span className="text-gray-400">AED/mo</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-red-600" /> Unlimited access
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-red-600" /> HD Streaming
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-red-600" /> Cancel anytime
                </li>
              </ul>
              <button 
                onClick={() => onSubscribe('monthly')}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                Subscribe Now
              </button>
            </div>

            {/* Yearly Plan */}
            <div className="bg-zinc-800/50 p-6 rounded-xl border border-red-600/50 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-tighter">
                Best Value
              </div>
              <div className="mb-4">
                <span className="text-red-600 font-bold uppercase text-xs tracking-wider">Yearly</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">100</span>
                  <span className="text-gray-400">AED/yr</span>
                </div>
                <p className="text-[10px] text-green-500 font-medium mt-1">Save 200 AED compared to monthly</p>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-red-600" /> Everything in Monthly
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-red-600" /> 4K Ultra HD
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-red-600" /> Priority Support
                </li>
              </ul>
              <button 
                onClick={() => onSubscribe('yearly')}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                Subscribe Now
              </button>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4 justify-center text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Secure Payment
            </div>
            <div className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" /> Multiple Methods
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AdminPanel = ({ onClose }: { onClose: () => void }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [genre, setGenre] = useState('');
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'movies'), {
        title,
        description,
        thumbnail,
        videoUrl,
        genre,
        releaseYear: Number(releaseYear),
        createdAt: Timestamp.now()
      });
      setMessage('Movie added successfully!');
      setTitle('');
      setDescription('');
      setThumbnail('');
      setVideoUrl('');
      setGenre('');
    } catch (err) {
      console.error(err);
      setMessage('Error adding movie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative bg-zinc-900 w-full max-w-xl rounded-xl overflow-hidden border border-white/10"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-red-600" /> Add New Movie
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="text" 
              placeholder="Movie Title" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-zinc-800 border border-white/10 rounded px-4 py-2 text-white focus:outline-none focus:border-red-600"
            />
            <textarea 
              placeholder="Description" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded px-4 py-2 text-white focus:outline-none focus:border-red-600 h-24"
            />
            <input 
              type="url" 
              placeholder="Thumbnail URL" 
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              required
              className="w-full bg-zinc-800 border border-white/10 rounded px-4 py-2 text-white focus:outline-none focus:border-red-600"
            />
            <input 
              type="url" 
              placeholder="Video URL (Direct link or YouTube/Vimeo)" 
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
              className="w-full bg-zinc-800 border border-white/10 rounded px-4 py-2 text-white focus:outline-none focus:border-red-600"
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Genre" 
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded px-4 py-2 text-white focus:outline-none focus:border-red-600"
              />
              <input 
                type="number" 
                placeholder="Year" 
                value={releaseYear}
                onChange={(e) => setReleaseYear(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-white/10 rounded px-4 py-2 text-white focus:outline-none focus:border-red-600"
              />
            </div>
            <button 
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Movie'}
            </button>
            {message && <p className={`text-center text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const VideoPlayer = ({ movie, onClose }: { movie: Movie, onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10">
        <button onClick={onClose} className="text-white flex items-center gap-2 hover:text-gray-300">
          <ChevronLeft className="w-8 h-8" />
          <span className="font-bold text-xl">{movie.title}</span>
        </button>
      </div>
      <div className="flex-grow flex items-center justify-center">
        {movie.videoUrl.includes('youtube.com') || movie.videoUrl.includes('youtu.be') ? (
          <iframe 
            src={movie.videoUrl.replace('watch?v=', 'embed/').split('&')[0]} 
            className="w-full h-full"
            allowFullScreen
          />
        ) : (
          <video 
            src={movie.videoUrl} 
            controls 
            autoPlay 
            className="w-full max-h-full"
          />
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            role: u.email === 'nasiralzaabi351@gmail.com' ? 'admin' : 'user',
            subscriptionStatus: 'inactive',
            subscriptionType: 'none',
            subscriptionExpiry: null
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Movies Listener - Only run when authenticated to avoid permission errors
  useEffect(() => {
    if (!user) {
      setMovies([]);
      return;
    }

    const path = 'movies';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const movieList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movie));
      setMovies(movieList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, [user]);

  const handleSubscribe = async (type: 'monthly' | 'yearly') => {
    if (!user) return;
    
    const expiryDate = new Date();
    if (type === 'monthly') expiryDate.setMonth(expiryDate.getMonth() + 1);
    else expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const updatedProfile: Partial<UserProfile> = {
      subscriptionStatus: 'active',
      subscriptionType: type,
      subscriptionExpiry: Timestamp.fromDate(expiryDate)
    };

    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      setProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
      setShowSubscription(false);
      alert(`Successfully subscribed to ${type} plan!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handlePlay = (movie: Movie) => {
    if (profile?.subscriptionStatus !== 'active' && profile?.role !== 'admin') {
      setShowSubscription(true);
      return;
    }
    setSelectedMovie(movie);
    setIsPlaying(true);
  };

  const handleReact = async (movie: Movie, emoji: string) => {
    if (!user) return;
    const path = `movies/${movie.id}`;
    const currentReactions = movie.reactions || {};
    const updatedReactions = {
      ...currentReactions,
      [emoji]: (currentReactions[emoji] || 0) + 1
    };

    try {
      await setDoc(doc(db, 'movies', movie.id), { reactions: updatedReactions }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const heroMovie = movies[0];

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-600/30">
      <Navbar 
        user={user} 
        profile={profile} 
        onSignOut={() => signOut(auth)} 
        onOpenAdmin={() => setShowAdmin(true)}
        onOpenDiscovery={() => setShowDiscovery(true)}
        onOpenChat={() => setShowAIChat(true)}
      />

      {/* Hero Section */}
      {heroMovie ? (
        <div className="relative h-[80vh] md:h-[95vh] w-full">
          <div className="absolute inset-0">
            <img 
              src={heroMovie.thumbnail} 
              alt={heroMovie.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          </div>

          <div className="absolute bottom-[15%] left-4 md:left-12 max-w-2xl">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl md:text-7xl font-bold mb-4 drop-shadow-lg"
            >
              {heroMovie.title}
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm md:text-lg text-gray-200 mb-8 line-clamp-3 drop-shadow"
            >
              {heroMovie.description}
            </motion.p>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handlePlay(heroMovie)}
                className="bg-white text-black px-6 md:px-8 py-2 md:py-3 rounded flex items-center gap-2 font-bold hover:bg-white/90 transition-colors"
              >
                <Play className="w-5 h-5 fill-current" /> Play
              </button>
              <button className="bg-gray-500/50 text-white px-6 md:px-8 py-2 md:py-3 rounded flex items-center gap-2 font-bold hover:bg-gray-500/40 transition-colors backdrop-blur-md">
                <Info className="w-5 h-5" /> More Info
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[80vh] flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-4xl font-bold mb-4">Welcome to Tefiles</h2>
          <p className="text-gray-400 max-w-md mb-8">The ultimate destination for exclusive movies and shows. Sign in to start watching.</p>
          {!user && (
            <button 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
              className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
            >
              Get Started
            </button>
          )}
        </div>
      )}

      {/* Movie Rows */}
      <div className="relative z-10 -mt-20 md:-mt-32 pb-20">
        {movies.length > 0 && (
          <>
            <MovieRow title="Trending Now" movies={movies} onMovieClick={handlePlay} onReact={handleReact} />
            <MovieRow title="New Releases" movies={movies.slice().reverse()} onMovieClick={handlePlay} onReact={handleReact} />
            <MovieRow title="Action & Adventure" movies={movies.filter(m => m.genre?.toLowerCase().includes('action'))} onMovieClick={handlePlay} onReact={handleReact} />
            <MovieRow title="Drama" movies={movies.filter(m => m.genre?.toLowerCase().includes('drama'))} onMovieClick={handlePlay} onReact={handleReact} />
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
        {showSubscription && <SubscriptionModal onClose={() => setShowSubscription(false)} onSubscribe={handleSubscribe} />}
        {showDiscovery && <DiscoveryMode movies={movies} onPlay={handlePlay} onClose={() => setShowDiscovery(false)} />}
        {showAIChat && <AIChatAssistant movies={movies} onClose={() => setShowAIChat(false)} />}
        {isPlaying && selectedMovie && (
          <VideoPlayer movie={selectedMovie} onClose={() => setIsPlaying(false)} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="px-4 md:px-12 py-12 border-t border-white/10 text-gray-500 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="flex flex-col gap-2">
            <a href="#" className="hover:underline">Audio Description</a>
            <a href="#" className="hover:underline">Help Center</a>
            <a href="#" className="hover:underline">Gift Cards</a>
          </div>
          <div className="flex flex-col gap-2">
            <a href="#" className="hover:underline">Media Center</a>
            <a href="#" className="hover:underline">Investor Relations</a>
            <a href="#" className="hover:underline">Jobs</a>
          </div>
          <div className="flex flex-col gap-2">
            <a href="#" className="hover:underline">Terms of Use</a>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Legal Notices</a>
          </div>
          <div className="flex flex-col gap-2">
            <a href="#" className="hover:underline">Cookie Preferences</a>
            <a href="#" className="hover:underline">Corporate Information</a>
            <a href="#" className="hover:underline">Contact Us</a>
          </div>
        </div>
        <p>© 2026 Tefiles Streaming Service. All rights reserved.</p>
      </footer>
    </div>
  );
}
