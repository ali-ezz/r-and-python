import { useState } from 'react';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setEmail('');
    }
  };

  return (
    <section className="py-16 md:py-24 px-4 md:px-8 bg-gray-50">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl tracking-[0.2em] font-light uppercase mb-4">
          Newsletter
        </h2>
        <div className="w-12 h-px bg-black mx-auto mb-4" />
        <p className="text-sm text-gray-500 mb-8 tracking-wide leading-relaxed">
          Subscribe to receive updates on new arrivals, special offers, and our latest collections.
        </p>

        {submitted ? (
          <div className="py-4 text-sm tracking-widest text-black fade-in">
            ✓ THANK YOU FOR SUBSCRIBING
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="EMAIL ADDRESS"
                required
                className="w-full border-b-2 border-gray-300 focus:border-black bg-transparent py-3 px-1 text-sm tracking-widest outline-none transition-colors placeholder:text-gray-400"
              />
            </div>
            <button
              type="submit"
              className="bg-black text-white px-10 py-3 text-xs tracking-[0.3em] uppercase hover:bg-gray-800 transition-colors shrink-0"
            >
              SUBSCRIBE
            </button>
          </form>
        )}

        <p className="text-[10px] text-gray-400 mt-6 tracking-wide">
          By subscribing, you agree to our Privacy Policy and consent to receive updates.
        </p>
      </div>
    </section>
  );
}
