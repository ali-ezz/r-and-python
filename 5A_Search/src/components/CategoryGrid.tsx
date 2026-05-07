const categories = [
  {
    title: 'WOMAN',
    image: '/images/promo1.jpg',
    link: '#woman',
  },
  {
    title: 'MAN',
    image: '/images/promo2.jpg',
    link: '#man',
  },
  {
    title: 'KIDS',
    image: '/images/collection.jpg',
    link: '#kids',
  },
];

export default function CategoryGrid() {
  return (
    <section className="py-16 md:py-24 px-4 md:px-8 max-w-[1400px] mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-2xl md:text-3xl tracking-[0.2em] font-light uppercase">Collections</h2>
        <div className="w-12 h-px bg-black mx-auto mt-4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <a
            key={cat.title}
            href={cat.link}
            className="group relative overflow-hidden aspect-[3/4] bg-gray-100"
          >
            <img
              src={cat.image}
              alt={cat.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-all duration-500" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <h3 className="text-white text-2xl md:text-3xl tracking-[0.3em] font-light">
                {cat.title}
              </h3>
              <span className="text-white text-xs tracking-[0.3em] mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                SHOP NOW →
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
