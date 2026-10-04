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

// Increase Item Quantity (+ Button)
function increaseQty(name) {
    const item = cart.find(i => i.name === name);
    if (item) {
        item.qty += 1;
        saveCart();
        if (typeof renderBasketPage === "function") renderBasketPage();
    }
}

// Decrease Item Quantity (- Button)
function decreaseQty(name) {
    const item = cart.find(i => i.name === name);
    if (item) {
        item.qty -= 1;
        // If quantity drops to 0, remove the item completely from basket
        if (item.qty <= 0) {
            cart = cart.filter(i => i.name !== name);
        }
        saveCart();
        if (typeof renderBasketPage === "function") renderBasketPage();
    }
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
        document.getElementById('delivery-price').innerText = "Extra";
        document.getElementById('total-price').innerText = "₹0.00";
        return;
    }
    
    let subtotal = 0;
    cart.forEach(item => {
        const itemCost = item.price * item.qty;
        subtotal += itemCost;
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #F3F4F6; padding-bottom:8px;">
                <div>
                    <strong>${item.name}</strong><br>
                    <small style="color:#6B7280;">₹${item.price.toFixed(2)} each</small>
                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 8px;">
                        <button onclick="decreaseQty('${item.name}')" style="background:#E5E7EB; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; font-weight:bold;">-</button>
                        <span>${item.qty}</span>
                        <button onclick="increaseQty('${item.name}')" style="background:#E5E7EB; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; font-weight:bold;">+</button>
                    </div>
                </div>
                <strong>₹${itemCost.toFixed(2)}</strong>
            </div>
        `;
    });
    
    // Updated to mention delivery is extra
    document.getElementById('delivery-price').innerText = "Extra";
    document.getElementById('total-price').innerText = `₹${subtotal.toFixed(2)}`;
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
        itemListingText += `${index + 1}. ${item.name} x${item.qty} - ₹${cost.toFixed(2)}\n`;
    });
    
    let orderMsg = `☘️ *NEW ORDER - NATURAL BASKET* ☘️\n\n`;
    orderMsg += `*Customer:* ${name}\n*Mobile:* ${phone}\n\n`;
    orderMsg += `--- *Items* ---\n${itemListingText}\n`;
    orderMsg += `*Subtotal:* ₹${subtotal.toFixed(2)}\n`;
    orderMsg += `*Delivery Charge:* Extra (Will be confirmed on call/chat)\n`;
    orderMsg += `*Total Amount:* ₹${subtotal.toFixed(2)} + Delivery\n\n`;
    orderMsg += `*Shipping Address:* ${address}, ${city} - ${pincode}`;
    
    const shopPhone = "917993251579";
    const finalWhatsAppUrl = `https://whatsapp.com{shopPhone}&text=${encodeURIComponent(orderMsg)}`;
    
    window.open(finalWhatsAppUrl, '_blank');
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
