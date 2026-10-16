import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../lib/cart';

export default function Header() {
  const { count } = useCart();
  return (
    <header className="site-header">
      <a href="#main" className="skip-link">Skip to content</a>
      <Link to="/" className="brand" aria-label="Natural Basket home">
        <img src="/images/logo.webp" alt="" width={44} height={44} />
        <span>Natural Basket</span>
      </Link>
      <nav aria-label="Main">
        <NavLink to="/" end>Shop</NavLink>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
        <NavLink to="/basket" className="basket-link">
          Basket <span className="badge-count" aria-label={`${count} items in basket`}>{count}</span>
        </NavLink>
      </nav>
    </header>
  );
}
