export default function Footer() {
  return (
    <footer className="site-footer">
      <section id="about" className="about">
        <div className="about-card">
          <h2>About Natural Basket</h2>
          <p>Natural Basket is a farm-to-home service bringing chemical-free produce, fresh milk and traditional foods to Hyderabad and nearby regions.</p>
        </div>
        <div className="about-card highlight">
          <h2>Our Vision</h2>
          <p>A healthier community, with natural farm-fresh food within reach of every home and fair support for local farmers.</p>
        </div>
        <div className="about-card">
          <h2>Delivery</h2>
          <p>We deliver across Hyderabad and nearby areas. Delivery charges, if any, are confirmed on WhatsApp before your order is accepted.</p>
        </div>
      </section>
      <section id="contact" className="contact">
        <h2>Contact</h2>
        <p>Instagram: <a href="https://www.instagram.com/_natural_basket" target="_blank" rel="noopener noreferrer">@_natural_basket</a></p>
        <p>© {new Date().getFullYear()} Natural Basket. Serving Hyderabad and surrounding regions.</p>
      </section>
    </footer>
  );
}
