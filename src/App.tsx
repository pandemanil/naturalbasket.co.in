import { Route, Routes } from 'react-router-dom';
import { CartProvider } from './lib/cart';
import Header from './components/Header';
import Footer from './components/Footer';
import ShopPage from './pages/ShopPage';
import BasketPage from './pages/BasketPage';
import AdminLogin from './admin/AdminLogin';
import AdminDashboard from './admin/AdminDashboard';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <CartProvider>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route
          path="*"
          element={
            <div className="site">
              <Header />
              <main id="main">
                <Routes>
                  <Route path="/" element={<ShopPage />} />
                  <Route path="/basket" element={<BasketPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
          }
        />
      </Routes>
    </CartProvider>
  );
}
