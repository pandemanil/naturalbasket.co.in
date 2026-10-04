// Local Storage State Persistent Setup
let cart = JSON.parse(localStorage.getItem('nb_cart')) || [];

function saveCart() {
    localStorage.setItem('nb_cart', JSON.stringify(cart));
    updateCartCounter();
}

function updateCartCounter() {
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const counterElement = document.getElementById('cart-count');
    if (counterElement) counterElement.innerText = totalCount;
}

function addToCart(name, price) {
    const existing = cart.find(item => item.name === name);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ name, price, qty: 1 });
    }
    saveCart();
    alert(`${name} successfully added to basket!`);
}

function clearCart() {
    cart = [];
    saveCart();
    if (typeof renderBasketPage === "function") renderBasketPage();
}

function renderBasketPage() {
    const container = document.getElementById('basket-items');
    if (!container) return;
    
    container.innerHTML = "";
    if (cart.length === 0) {
        container.innerHTML = "<p style='color:#6B7280;'>Your basket is completely empty.</p>";
        document.getElementById('delivery-price').innerText = "₹0.00";
        document.getElementById('total-price').innerText = "₹0.00";
        return;
    }
    
    let subtotal = 0;
    cart.forEach(item => {
        const itemCost = item.price * item.qty;
        subtotal += itemCost;
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #F3F4F6; padding-bottom:8px;">
                <div>
                    <strong>${item.name}</strong><br>
                    <small style="color:#6B7280;">₹${item.price} x ${item.qty}</small>
                </div>
                <strong>₹${itemCost.toFixed(2)}</strong>
            </div>
        `;
    });
    
    const delivery = 50;
    document.getElementById('delivery-price').innerText = `₹${delivery.toFixed(2)}`;
    document.getElementById('total-price').innerText = `₹${(subtotal + delivery).toFixed(2)}`;
}

function filterCategory(event, categorySelection) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
        const itemTag = card.getAttribute('data-category');
        if (categorySelection === 'all' || itemTag === categorySelection) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function checkoutWhatsApp(event) {
    event.preventDefault();
    if (cart.length === 0) return alert("Basket Empty!");
    
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const city = document.getElementById('city').value;
    const pincode = document.getElementById('pincode').value;
    
    let itemListingText = "";
    let subtotal = 0;
    cart.forEach((item, index) => {
        const cost = item.price * item.qty;
        subtotal += cost;
        itemListingText += `${index + 1}. ${item.name} x${item.qty} - ₹${cost}\n`;
    });
    
    let orderMsg = `☘️ *NEW ORDER - NATURAL BASKET* ☘️\n\n`;
    orderMsg += `*Customer:* ${name}\n*Mobile:* ${phone}\n\n`;
    orderMsg += `--- *Items* ---\n${itemListingText}\n`;
    orderMsg += `*Total cost:* ₹${(subtotal + 50).toFixed(2)} (inc. ₹50 delivery)\n\n`;
    orderMsg += `*Shipping Address:* ${address}, ${city} - ${pincode}`;
    
    window.open(`https://whatsapp.com{encodeURIComponent(orderMsg)}`, '_blank');
}

function handleLogin(event) {
    event.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    if (user === "admin" && pass === "hyd2026") {
        localStorage.setItem('nb_admin_authed', 'true');
        alert("Access Granted! Welcome to Admin Panel.");
        window.location.href = "admin.html";
    } else {
        document.getElementById('login-error').style.display = "block";
    }
}

// Initial Boot Sync Action
updateCartCounter();
