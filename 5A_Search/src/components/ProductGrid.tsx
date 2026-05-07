import { useState } from 'react';

interface Product {
  id: number;
  name: string;
  price: string;
  image: string;
  colors: string[];
  isNew?: boolean;
}

const products: Product[] = [
  {
    id: 1,
    name: 'OVERSIZED WOOL COAT',
    price: '$259.00',
    image: '/images/product1.jpg',
    colors: ['#c4a882', '#2d2d2d', '#f5f5f0'],
    isNew: true,
  },
  {
    id: 2,
    name: 'SLIM FIT TROUSERS',
    price: '$79.90',
    image: '/images/product2.jpg',
    colors: ['#1a1a1a', '#3d3d3d', '#6b6b6b'],
  },
  {
    id: 3,
    name: 'COTTON BUTTON-UP SHIRT',
    price: '$49.90',
    image: '/images/product3.jpg',
    colors: ['#ffffff', '#e8ddd0', '#1a1a1a'],
    isNew: true,
  },
  {
    id: 4,
    name: 'CASHMERE SWEATER',
    price: '$149.00',
    image: '/images/product4.jpg',
    colors: ['#e8ddd0', '#1a1a1a', '#8b6f4e'],
  },
  {
    id: 5,
    name: 'WOOL BLEND BLAZER',
    price: '$199.00',
    image: '/images/product1.jpg',
    colors: ['#2d2d2d', '#4a4a4a'],
  },
  {
    id: 6,
    name: 'HIGH-WAIST JEANS',
    price: '$69.90',
    image: '/images/product2.jpg',
    colors: ['#4a6fa5', '#1a1a1a', '#8b8b8b'],
    isNew: true,
  },
  {
    id: 7,
    name: 'LINEN BLEND DRESS',
    price: '$129.00',
    image: '/images/product3.jpg',
    colors: ['#e8ddd0', '#f5f5f0'],
  },
  {
    id: 8,
    name: 'MERINO WOOL CARDIGAN',
    price: '$119.00',
    image: '/images/product4.jpg',
    colors: ['#2d2d2d', '#e8ddd0', '#6b4c3b'],
  },
];

function ProductCard({ product }: { product: Product }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-[3/4] bg-gray-50 mb-4">
        <img
          src={product.image}
          alt={product.name}
          className={`w-full h-full object-cover transition-all duration-700 ${
            isHovered ? 'scale-105 brightness-95' : 'scale-100'
          }`}
        />

        {/* Quick view overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-black/80 text-white text-center py-3 text-xs tracking-[0.2em] transition-all duration-300 ${
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        >
          QUICK VIEW
        </div>

        {/* New tag */}
        {product.isNew && (
          <div className="absolute top-3 left-3 bg-black text-white text-[10px] tracking-widest px-3 py-1">
            NEW
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2">
        <h3 className="text-xs tracking-[0.15em] font-medium uppercase">
          {product.name}
        </h3>
        <p className="text-sm text-gray-600">{product.price}</p>

        {/* Color swatches */}
        <div className="flex gap-1.5 pt-1">
          {product.colors.map((color, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full border border-gray-200 cursor-pointer hover:scale-125 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductGrid() {
  const [filter, setFilter] = useState('ALL');

  const filters = ['ALL', 'NEW IN', 'COATS', 'TOPS', 'TROUSERS', 'KNITWEAR'];

  return (
    <section id="products" className="py-16 md:py-24 px-4 md:px-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl tracking-[0.2em] font-light uppercase">New In</h2>
        <div className="w-12 h-px bg-black mx-auto mt-4" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-12">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs tracking-[0.2em] pb-1 transition-all duration-200 ${
              filter === f
                ? 'border-b-2 border-black font-medium'
                : 'text-gray-400 hover:text-black'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Load more */}
      <div className="text-center mt-16">
        <button className="border-2 border-black text-black px-12 py-4 text-xs tracking-[0.3em] uppercase hover:bg-black hover:text-white transition-all duration-300">
          VIEW MORE
        </button>
      </div>
    </section>
  );
}
