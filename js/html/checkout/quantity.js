window.selectCoin = function(element, coin)
{
    document.querySelectorAll('.crypto-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    window.selectedCurrency = coin;
};

window.switchPaymentTab = function(tab)
{
    document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.payment-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.payment-tab[onclick="switchPaymentTab('${tab}')"]`)?.classList.add('active');
    document.getElementById(`payment-${tab}`)?.classList.add('active');
};

document.getElementById('qty-minus').addEventListener('click', () =>
{
    if(window.quantity > 1)
    {
        window.quantity--;
        document.getElementById('qty-value').value = window.quantity;
        window.updatePriceDisplay();
    }
});

document.getElementById('qty-plus').addEventListener('click', () =>
{
    if(window.quantity < 10)
    {
        window.quantity++;
        document.getElementById('qty-value').value = window.quantity;
        window.updatePriceDisplay();
    }
});

document.getElementById('qty-value').addEventListener('change', (e) =>
{
    let val = parseInt(e.target.value) || 1;
    val = Math.max(1, Math.min(10, val));
    window.quantity = val;
    e.target.value = window.quantity;
    window.updatePriceDisplay();
});
