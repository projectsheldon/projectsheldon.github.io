function selectCoin(element, coin)
{
    document.querySelectorAll('.crypto-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    window.selectedCurrency = coin;
}

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