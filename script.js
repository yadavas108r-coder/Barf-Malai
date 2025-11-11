// Global cart variable
let cart = [];

// Cart functions
function addToCart(productId, productName, productPrice, productImage) {
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: productName,
            price: productPrice,
            image: productImage,
            quantity: 1
        });
    }
    
    updateCart();
    showToast(`${productName} added to cart!`);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCart();
        }
    }
}

function updateCart() {
    // Update cart count
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = cartCount;
    
    // Update cart items
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-state">Your cart is empty</p>';
        cartTotal.textContent = '0';
        return;
    }
    
    let total = 0;
    cartItems.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        return `
            <div class="cart-item">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">₹${item.price} × ${item.quantity} = ₹${itemTotal}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                    <button class="remove-btn" onclick="removeFromCart('${item.id}')">Remove</button>
                </div>
            </div>
        `;
    }).join('');
    
    cartTotal.textContent = total.toFixed(2);
    
    // Save cart to localStorage
    saveCart();
}

function loadCart() {
    const savedCart = localStorage.getItem('barfMalaiCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCart();
    }
}

function saveCart() {
    localStorage.setItem('barfMalaiCart', JSON.stringify(cart));
}

function clearCart() {
    cart = [];
    updateCart();
}

// UI Functions
function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');
    
    cartSidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function showCheckoutForm() {
    if (cart.length === 0) {
        showToast('Your cart is empty!');
        return;
    }
    
    const modal = document.getElementById('checkoutModal');
    const overlay = document.getElementById('overlay');
    const orderSummary = document.getElementById('orderSummary');
    const orderTotal = document.getElementById('orderTotal');
    
    // Update order summary
    let total = 0;
    orderSummary.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="order-item">
                <span>${item.quantity}x ${item.name}</span>
                <span>₹${itemTotal}</span>
            </div>
        `;
    }).join('');
    
    orderTotal.textContent = total.toFixed(2);
    
    modal.classList.add('active');
    overlay.classList.add('active');
}

function closeCheckoutForm() {
    const modal = document.getElementById('checkoutModal');
    const overlay = document.getElementById('overlay');
    
    modal.classList.remove('active');
    overlay.classList.remove('active');
}

// Order functions
function placeOrder(event) {
    event.preventDefault();
    
    const formData = {
        customerName: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        email: document.getElementById('customerEmail').value,
        note: document.getElementById('customerNote').value,
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Placing Order...';
    submitBtn.disabled = true;
    
    google.script.run
        .withSuccessHandler(function(response) {
            showToast(`Order placed successfully! Order ID: ${response.orderId}`);
            closeCheckoutForm();
            clearCart();
            toggleCart();
            
            // Reset form
            document.getElementById('checkoutForm').reset();
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        })
        .withFailureHandler(function(error) {
            showToast('Failed to place order. Please try again.');
            console.error('Order error:', error);
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        })
        .placeOrder(formData);
}

// Admin functions
function addNewCategory(event) {
    event.preventDefault();
    
    const name = document.getElementById('categoryName').value;
    const imageInput = document.getElementById('categoryImage');
    
    if (!imageInput.files[0]) {
        showError('Please select an image');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        google.script.run
            .withSuccessHandler(function(response) {
                showToast('Category added successfully!');
                document.getElementById('categoryForm').reset();
                document.getElementById('categoryPreview').style.display = 'none';
                loadCategories();
            })
            .withFailureHandler(showError)
            .addCategory(name, e.target.result);
    };
    reader.readAsDataURL(imageInput.files[0]);
}

function addNewProduct(event) {
    event.preventDefault();
    
    const name = document.getElementById('productName').value;
    const category = document.getElementById('productCategory').value;
    const price = document.getElementById('productPrice').value;
    const description = document.getElementById('productDescription').value;
    const imageInput = document.getElementById('productImage');
    
    if (!imageInput.files[0]) {
        showError('Please select an image');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        google.script.run
            .withSuccessHandler(function(response) {
                showToast('Product added successfully!');
                document.getElementById('productForm').reset();
                document.getElementById('productPreview').style.display = 'none';
                loadProducts();
            })
            .withFailureHandler(showError)
            .addProduct(category, name, price, e.target.result, description);
    };
    reader.readAsDataURL(imageInput.files[0]);
}

function editCategory(categoryId) {
    // Implementation for editing category
    showToast('Edit category functionality coming soon!');
}

function deleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this category?')) {
        google.script.run
            .withSuccessHandler(function() {
                showToast('Category deleted successfully!');
                loadCategories();
            })
            .withFailureHandler(showError)
            .deleteCategory(categoryId);
    }
}

function editProduct(productId) {
    // Implementation for editing product
    showToast('Edit product functionality coming soon!');
}

function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        google.script.run
            .withSuccessHandler(function() {
                showToast('Product deleted successfully!');
                loadProducts();
            })
            .withFailureHandler(showError)
            .deleteProduct(productId);
    }
}

function updateOrderStatus(timestamp, status) {
    google.script.run
        .withSuccessHandler(function() {
            showToast('Order status updated!');
        })
        .withFailureHandler(showError)
        .updateOrderStatus(timestamp, status);
}

function viewOrderDetails(timestamp) {
    // Implementation for viewing order details
    showToast('Order details view coming soon!');
}

// Utility functions
function showError(error) {
    console.error('Error:', error);
    alert('An error occurred: ' + error.message);
}

function showToast(message) {
    // This function is implemented in the HTML files
    console.log('Toast:', message);
}

// Image preview function
function previewImage(input, previewId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewId);
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
}
