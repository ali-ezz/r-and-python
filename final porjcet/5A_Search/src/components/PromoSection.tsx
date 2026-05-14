export default function PromoSection() {
  return (
    <section className="py-16 md:py-24">
      {/* Full-width banner */}
      <div className="relative w-full h-[50vh] md:h-[70vh] overflow-hidden group">
        <img
          src="/images/promo1.jpg"
          alt="Autumn Collection"
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <p className="text-xs tracking-[0.5em] mb-4 font-light">LIMITED EDITION</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-wider mb-6">
            JOIN LIFE
          </h2>
          <p className="text-sm md:text-base tracking-wide mb-8 max-w-lg text-center font-light leading-relaxed px-4">
            A commitment to sustainability. Fashion made with care for people and the environment.
          </p>
          <a
            href="#"
            className="border-2 border-white text-white px-10 py-4 text-xs tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-all duration-300"
          >
            LEARN MORE
          </a>
        </div>
      </div>

      {/* Two-column promo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left */}
        <div className="relative aspect-square md:aspect-auto md:h-[600px] overflow-hidden group">
          <img
            src="/images/promo2.jpg"
            alt="Men's Collection"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-all duration-500" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-white text-xs tracking-[0.4em] mb-3">NEW ARRIVALS</p>
            <h3 className="text-white text-3xl md:text-4xl tracking-[0.2em] font-light mb-6">
              MAN
            </h3>
            <a
              href="#"
              className="text-white border-b border-white text-xs tracking-[0.3em] uppercase pb-1 hover:opacity-70 transition-opacity"
            >
              SHOP NOW
            </a>
          </div>
        </div>

        {/* Right */}
        <div className="relative aspect-square md:aspect-auto md:h-[600px] overflow-hidden group bg-black flex items-center justify-center">
          <div className="p-12 md:p-16 text-center">
            <p className="text-gray-400 text-xs tracking-[0.4em] mb-4">EXCLUSIVE</p>
            <h3 className="text-white text-3xl md:text-4xl tracking-[0.2em] font-light mb-6">
              STUDIO COLLECTION
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
              Explore our most curated collection. Premium fabrics, timeless silhouettes, and elevated essentials designed for the modern wardrobe.
            </p>
            <a
              href="#"
              className="text-white border-b border-white text-xs tracking-[0.3em] uppercase pb-1 hover:opacity-70 transition-opacity"
            >
              DISCOVER
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
