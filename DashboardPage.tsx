/**
 * @fileoverview Login page — Zara-inspired minimal authentication form.
 */

import { useState, FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Left — editorial panel */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col justify-between p-16 relative overflow-hidden">
        <div className="fade-in">
          <div className="text-white text-3xl font-semibold tracking-widest uppercase">SMS</div>
          <div className="text-[#666] text-xs tracking-[0.2em] uppercase mt-1">Student Management System</div>
        </div>

        <div className="slide-up">
          <blockquote className="text-white text-xl font-light leading-relaxed max-w-sm">
            "Education is not the filling of a pail, but the lighting of a fire."
          </blockquote>
          <div className="text-[#666] text-xs tracking-[0.1em] uppercase mt-4">— Ahmed Abobakr</div>
        </div>

        <div className="fade-in text-[#444] text-xs tracking-[0.08em] uppercase">
          © {new Date().getFullYear()} SMS Platform
        </div>

        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden mb-12">
            <div className="text-2xl font-semibold tracking-widest uppercase">SMS</div>
            <div className="text-[#999] text-xs tracking-[0.15em] uppercase">Student Management System</div>
          </div>

          <div className="mb-10">
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Sign in</h1>
            <p className="text-[#666] text-sm">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.edu"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 bottom-3 text-[#999] text-xs hover:text-black transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="scale-in bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-[#9B1C1C] text-sm whitespace-pre-wrap">
                {error.split(' | ').map((msg: string, i: number) => (
                  <div key={i} className="mb-1 last:mb-0">• {msg}</div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
              id="login-submit"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#666]">
            Don't have an account?{' '}
            <a href="#/signup" onClick={() => window.location.hash = '#/signup'} className="text-black hover:underline font-medium">
              Create one
            </a>
          </div>

          {/* Demo credentials */}
          <div className="mt-10 pt-8 border-t border-[#E5E5E5]">
            <div className="text-[10px] text-[#999] tracking-[0.1em] uppercase mb-4">Demo accounts</div>
            <div className="space-y-3">
              {[
                { role: 'Admin', email: 'admin@sms.edu', pass: 'Admin@2026' },
                { role: 'Instructor', email: 'dr.ahmed@sms.edu', pass: 'Instructor@2026' },
                { role: 'Student', email: 'ahmed.al-hassan0@student.sms.edu', pass: 'Student@2026' },
              ].map((cred) => (
                <button
                  key={cred.role}
                  type="button"
                  onClick={() => { setEmail(cred.email); setPassword(cred.pass); }}
                  className="w-full flex justify-between items-center px-3 py-2 border border-[#E5E5E5] hover:border-black transition-colors text-xs"
                >
                  <span className="font-medium text-[#1A1A1A]">{cred.role}</span>
                  <span className="text-[#999]">{cred.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
