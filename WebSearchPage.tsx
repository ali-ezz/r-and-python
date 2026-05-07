/**
 * @fileoverview Signup page — Zara-inspired registration form with
 * first name, last name, email, and password with strength validation.
 */

import { useState, FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';

export default function SignupPage() {
  const { register, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password strength
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const strengthPct = [hasLength, hasUpper, hasDigit].filter(Boolean).length / 3;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await register({
      email,
      password,
      full_name: `${firstName} ${lastName}`.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-row-reverse">
      {/* Right — editorial panel */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col justify-between p-16 relative overflow-hidden">
        <div className="fade-in">
          <div className="text-white text-3xl font-semibold tracking-widest uppercase">SMS</div>
          <div className="text-[#666] text-xs tracking-[0.2em] uppercase mt-1">Student Management System</div>
        </div>

        <div className="slide-up">
          <blockquote className="text-white text-xl font-light leading-relaxed max-w-sm">
            "The roots of education are bitter, but the fruit is sweet."
          </blockquote>
          <div className="text-[#666] text-xs tracking-[0.1em] uppercase mt-4">— Aristotle</div>
        </div>

        <div className="fade-in text-[#444] text-xs tracking-[0.08em] uppercase">
          © {new Date().getFullYear()} SMS Platform
        </div>

        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
      </div>

      {/* Left — signup form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden mb-12">
            <div className="text-2xl font-semibold tracking-widest uppercase">SMS</div>
            <div className="text-[#999] text-xs tracking-[0.15em] uppercase">Student Management System</div>
          </div>

          <div className="mb-10">
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Create Account</h1>
            <p className="text-[#666] text-sm">Join the student platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label" htmlFor="firstName">First name</label>
                <input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="lastName">Last name</label>
                <input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

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
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
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
              {/* Password strength meter */}
              {password && (
                <div className="mt-3 space-y-2">
                  <div className="h-1 bg-[#F5F5F5] overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${strengthPct * 100}%`,
                        background: strengthPct < 0.5 ? '#9B1C1C' : strengthPct < 1 ? '#C9A961' : '#2D6A4F',
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    {[
                      { ok: hasLength, text: '8+ characters' },
                      { ok: hasUpper, text: 'One uppercase letter' },
                      { ok: hasDigit, text: 'One digit' },
                    ].map(({ ok, text }) => (
                      <div key={text} className={`text-[11px] flex items-center gap-1.5 ${ok ? 'text-[#2D6A4F]' : 'text-[#999]'}`}>
                        <span>{ok ? '✓' : '○'}</span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              className="btn-primary w-full mt-8"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-[#666]">
            Already have an account?{' '}
            <a href="#/login" onClick={() => window.location.hash = '#/login'} className="text-black hover:underline font-medium">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
