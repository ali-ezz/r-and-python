import { useEffect, useRef, useState } from 'react';

const slides = [
  {
    image: '/images/hero.jpg',
    title: 'NEW SEASON',
    subtitle: 'AUTUMN WINTER 2025',
    cta: 'DISCOVER THE COLLECTION',
    link: '#new',
  },
  {
    image: '/images/collection.jpg',
    title: 'ESSENTIALS',
    subtitle: 'TIMELESS PIECES',
    cta: 'SHOP NOW',
    link: '#products',
  },
];

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
        setIsVisible(true);
      }, 500);
    }, 6000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const slide = slides[currentSlide];

  return (
    <section className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden bg-gray-100">
      {/* Background image */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-in-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        }`}
      >
        <img
          src={slide.image}
          alt={slide.title}
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Content */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center text-white transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-xs md:text-sm tracking-[0.4em] mb-4 font-light">
          {slide.subtitle}
        </p>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-wider mb-8">
          {slide.title}
        </h1>
        <a
          href={slide.link}
          className="border-2 border-white text-white px-10 py-4 text-xs tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-all duration-300"
        >
          {slide.cta}
        </a>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => {
                setCurrentSlide(i);
                setIsVisible(true);
              }, 500);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === currentSlide ? 'bg-white w-8' : 'bg-white/50'
            }`}
          />
        ))}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 right-8 hidden md:flex flex-col items-center gap-2 text-white">
        <span className="text-[10px] tracking-widest uppercase rotate-90 origin-center mb-6">Scroll</span>
        <div className="w-px h-12 bg-white/50 animate-pulse" />
      </div>
    </section>
  );
}
