import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function AuthScreens() {
  const { signIn, signUp, signInWithGoogle, mode } = useAuth();
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Focus ref
  const emailInputRef = useRef(null);

  useEffect(() => {
    setError('');
    setName('');
    setPassword('');
    setConfirmPassword('');
    setTimeout(() => emailInputRef.current?.focus(), 100);
  }, [isLogin]);

  // Clean Firebase Error messages for human-friendly displays
  const getFriendlyErrorMessage = (err) => {
    const code = err.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'Account not found. Please sign up first!';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email is already in use by another account.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/network-request-failed':
        return 'Network error occurred. Please check your connection.';
      default:
        return err.message || 'An unexpected error occurred. Please try again.';
    }
  };

  const validateForm = () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (!isLogin) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(name, email, password);
      }
    } catch (err) {
      console.error('Auth error captured:', err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-start md:justify-center bg-white p-6 py-12 md:py-8 overflow-y-auto font-sans select-none animate-in fade-in duration-200">
      

      {/* 2. SLACK LOGO */}
      <div className="flex items-center gap-2 mb-6 select-none scale-105">
        <div className="w-8 h-8 flex flex-wrap gap-[2px] rotate-12 shrink-0">
          <div className="w-3.5 h-3.5 bg-[#36C5F0] rounded-tl-full rounded-r-full" />
          <div className="w-3.5 h-3.5 bg-[#2BAC76] rounded-tr-full rounded-b-full" />
          <div className="w-3.5 h-3.5 bg-[#ECB22E] rounded-bl-full rounded-t-full" />
          <div className="w-3.5 h-3.5 bg-[#E01E5A] rounded-br-full rounded-l-full" />
        </div>
        <span className="text-2xl font-black text-[#1D1C1D] tracking-tight">slack</span>
      </div>

      {/* 3. CENTERED FORM CARD */}
      <div className="w-full max-w-[440px] flex flex-col items-center">
        
        <h2 className="text-3xl font-extrabold text-[#1D1C1D] tracking-tight text-center mb-1.5">
          {isLogin ? 'Sign in to Slack' : 'Create your account'}
        </h2>
        <p className="text-sm text-[#616061] text-center mb-8 font-medium">
          We recommend using the email address you use at work.
        </p>

        {/* Form Card */}
        <div className="w-full bg-white border border-[#E8E8E8] rounded-2xl shadow-slack-modal p-8 space-y-5">
          
          {/* Error alarm */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold animate-in shake duration-200 leading-normal">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full h-11 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 font-bold rounded-lg text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-slate-100 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.33 0 3.267 2.69 1.18 6.62l4.086 3.145z" />
              <path fill="#FBBC05" d="M16.04 15.343c-1.07.728-2.43 1.157-4.04 1.157a7.07 7.07 0 0 1-6.734-4.857L1.18 14.788A11.96 11.96 0 0 0 12 24c3.273 0 6.273-1.09 8.564-2.945l-4.524-5.712z" />
              <path fill="#4285F4" d="M23.49 12.273c0-.818-.073-1.636-.218-2.427H12v4.61h6.464a5.53 5.53 0 0 1-2.4 3.633l4.524 5.713c2.645-2.437 4.902-6.027 4.902-11.256z" />
              <path fill="#34A853" d="M5.266 14.235a7.063 7.063 0 0 1-.368-2.235c0-.773.13-1.52.368-2.235L1.18 6.62A11.964 11.964 0 0 0 0 12c0 1.92.455 3.738 1.18 5.38l4.086-3.145z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1 select-none">
            <div className="flex-1 h-[1px] bg-[#E8E8E8]" />
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">OR</span>
            <div className="flex-1 h-[1px] bg-[#E8E8E8]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* NAME (SIGNUP ONLY) */}
            {!isLogin && (
              <div>
                <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    placeholder="Alice Doe"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                    required
                    tabIndex={1}
                  />
                </div>
              </div>
            )}

            {/* EMAIL */}
            <div>
              <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="name@work-email.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                  required
                  tabIndex={2}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                  required
                  tabIndex={3}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD (SIGNUP ONLY) */}
            {!isLogin && (
              <div>
                <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                    required
                    tabIndex={4}
                  />
                </div>
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-[#522653] hover:bg-[#522653]/95 text-white font-bold rounded-lg text-[15px] flex items-center justify-center gap-2 shadow-sm transition-all duration-100 hover:shadow active:scale-[0.99] mt-6 focus:outline-none focus:ring-2 focus:ring-[#522653]/20 cursor-pointer"
              tabIndex={5}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Please wait...</span>
                </>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>
          </form>

          {/* Toggle */}
          <div className="text-center pt-2.5 text-xs text-[#616061] font-bold border-t border-[#E8E8E8] mt-4 select-none">
            {isLogin ? (
              <p>
                New to Slack?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-[#1164A3] hover:underline cursor-pointer"
                  tabIndex={6}
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-[#1164A3] hover:underline cursor-pointer"
                  tabIndex={6}
                >
                  Sign in instead
                </button>
              </p>
            )}
          </div>

        </div>

        {mode === 'emulated' && (
          <div className="mt-8 p-3.5 rounded-lg border border-amber-100 bg-amber-50/50 text-[12px] text-amber-800 leading-normal max-w-sm text-center border-dashed font-sans">
            <b>Dev Emulator Mode</b>: Feel free to register any mock email (e.g. <i>user@acme.com</i>) with any 6-character password to test signups, logins, and session restores immediately!
          </div>
        )}
      </div>

    </div>
  );
}
